import {
	bufferToBase64Url,
	exportKeyToBase64Url,
	generateMasterKey,
	hashIVBase,
} from "@/lib/crypto";
import { base64UrlToBuffer } from "@/lib/crypto/keys";
import { CHUNK_SIZE, getTotalChunks } from "@/utils/upload";
import type { ChunkStatus, CompleteUploadResponse, SecuritySettings } from "@/types/upload";
import { CryptoWorkerClient } from "./crypto-worker-client";
import { PartUploader } from "./part-uploader";
import type { UploadPayload } from "./staging";
import { completeUpload, initiateUpload, type PartEtag } from "./upload-api";

const IV_BYTES = 12;

export interface UploadJob {
	payload: UploadPayload;
	settings: SecuritySettings;
	password: string | null;
}

export interface PipelineEvents {
	onFingerprint: (digest: string) => void;
	onChunk: (index: number, status: ChunkStatus) => void;
	onBytes: (bytes: number) => void;
}

interface KeyMaterial {
	keyBase64Url: string;
	ivBase: Uint8Array;
	ivBaseBase64Url: string;
}

async function createKeyMaterial(): Promise<KeyMaterial> {
	const keyBase64Url = await exportKeyToBase64Url(await generateMasterKey());
	const ivBase = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	return { keyBase64Url, ivBase, ivBaseBase64Url: bufferToBase64Url(ivBase.buffer) };
}

async function keyFingerprint(keyBase64Url: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", base64UrlToBuffer(keyBase64Url));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

interface ChunkRun {
	blob: Blob;
	totalChunks: number;
	worker: CryptoWorkerClient;
	uploader: PartUploader;
	events: PipelineEvents;
}

async function processChunk(run: ChunkRun, index: number): Promise<{ etag: PartEtag; bytes: number }> {
	const plain = await run.blob.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE).arrayBuffer();
	const plainBytes = plain.byteLength;
	run.events.onChunk(index, "encrypting");
	const cipher = await run.worker.encrypt(index, plain);
	run.events.onChunk(index, "uploading");
	const etag = await run.uploader.upload(index + 1, cipher);
	run.events.onChunk(index, "committed");
	run.events.onBytes(plainBytes);
	return { etag: { partNumber: index + 1, etag }, bytes: cipher.byteLength };
}

async function uploadAllChunks(run: ChunkRun): Promise<{ etags: PartEtag[]; encryptedSize: number }> {
	const etags: PartEtag[] = [];
	let encryptedSize = 0;
	for (let index = 0; index < run.totalChunks; index++) {
		try {
			const result = await processChunk(run, index);
			etags.push(result.etag);
			encryptedSize += result.bytes;
		} catch (err) {
			run.events.onChunk(index, "failed");
			throw err;
		}
	}
	return { etags, encryptedSize };
}

export async function runUpload(
	job: UploadJob,
	events: PipelineEvents,
): Promise<CompleteUploadResponse> {
	const { blob, fileName, mimeType } = job.payload;
	const totalChunks = getTotalChunks(blob.size);
	const material = await createKeyMaterial();
	events.onFingerprint(await keyFingerprint(material.keyBase64Url));

	const initiated = await initiateUpload({
		fileName,
		mimeType,
		originalSize: blob.size,
		totalChunks,
		ivBaseHash: await hashIVBase(material.ivBase),
		encryptionKey: material.keyBase64Url,
		ivBase: material.ivBaseBase64Url,
	});

	const worker = new CryptoWorkerClient();
	try {
		worker.start({
			keyBase64Url: material.keyBase64Url,
			ivBaseBase64Url: material.ivBaseBase64Url,
			fileId: initiated.fileId,
			totalChunks,
		});
		const uploader = new PartUploader(initiated.fileId, totalChunks, initiated.presignedUrls);
		const { etags, encryptedSize } = await uploadAllChunks({
			blob,
			totalChunks,
			worker,
			uploader,
			events,
		});
		return await completeUpload({
			fileId: initiated.fileId,
			encryptedSize,
			etags,
			securitySettings: job.settings,
			password: job.password,
		});
	} finally {
		worker.terminate();
	}
}
