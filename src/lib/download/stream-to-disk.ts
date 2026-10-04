import { decryptChunk, importKeyFromBase64Url } from "@/lib/crypto";
import { deriveIV } from "@/lib/crypto/iv";
import { fetchPresignedUrl } from "./presign";
import type { FileMeta } from "./types";

function encodeAAD(
	fileId: string,
	chunkIndex: number,
	totalChunks: number,
): Uint8Array {
	return new TextEncoder().encode(JSON.stringify({ fileId, chunkIndex, totalChunks }));
}

async function fetchChunkBytes(url: string, range: string, signal?: AbortSignal): Promise<Uint8Array> {
	const res = await fetch(url, { headers: { Range: range }, signal });
	if (!res.ok) throw new Error(`Failed to fetch chunk: HTTP ${res.status}`);
	const ct = res.headers.get("Content-Type") || "";
	if (ct.includes("text/html")) throw new Error("Received HTML instead of binary data.");
	return new Uint8Array(await res.arrayBuffer());
}

export interface StreamProgress {
	type: "progress" | "decrypting" | "done" | "error";
	chunkIndex?: number;
	loaded?: number;
	total?: number;
	error?: unknown;
}

export interface StreamDownloadOptions {
	meta: FileMeta;
	keyBase64Url: string;
	fileName: string;
	ivBase: Uint8Array;
	password?: string;
	onProgress?: (event: StreamProgress) => void;
	signal?: AbortSignal;
}

export function supportsFileSystemAccess(): boolean {
	return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

interface FileSystemFileHandle {
	createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream<Uint8Array> {
	write(data: BufferSource | Blob | string): Promise<void>;
	close(): Promise<void>;
}

declare global {
	interface Window {
		showSaveFilePicker(options?: {
			suggestedName?: string;
			types?: { description: string; accept: Record<string, string[]> }[];
		}): Promise<FileSystemFileHandle>;
	}
}

/**
 * Yields each decrypted chunk in order. Progress events are emitted around
 * the network and decrypt steps so callers can drive a chunk matrix.
 */
async function* decryptedChunks(
	options: StreamDownloadOptions,
): AsyncGenerator<Uint8Array> {
	const { meta, keyBase64Url, ivBase, password, onProgress, signal } = options;
	const key = await importKeyFromBase64Url(keyBase64Url);
	let sessionId: string | undefined;

	for (let i = 0; i < meta.total_chunks; i++) {
		if (signal?.aborted) return;

		onProgress?.({ type: "progress", chunkIndex: i, loaded: 0, total: meta.chunk_size });

		const presigned = await fetchPresignedUrl({
			fileId: meta.fileId,
			chunkIndex: i,
			preview: false,
			sessionId,
			password: sessionId ? undefined : password,
			signal,
		});
		sessionId = presigned.sessionId ?? sessionId;

		const encrypted = await fetchChunkBytes(presigned.url, presigned.range, signal);

		onProgress?.({ type: "progress", chunkIndex: i, loaded: encrypted.byteLength, total: encrypted.byteLength });
		onProgress?.({ type: "decrypting", chunkIndex: i });

		const aad = encodeAAD(meta.fileId, i, meta.total_chunks);
		yield await decryptChunk(key, deriveIV(ivBase, i), aad, encrypted);
	}
}

export async function streamDownloadToDisk(options: StreamDownloadOptions): Promise<void> {
	const fileHandle = await window.showSaveFilePicker({
		suggestedName: options.fileName,
		types: [{ description: "File", accept: { "*/*": [] } }],
	});

	const writable = await fileHandle.createWritable();
	try {
		for await (const plain of decryptedChunks(options)) {
			await writable.write(plain as unknown as BufferSource);
		}
	} finally {
		await writable.close();
	}

	options.onProgress?.({ type: "done" });
}

export async function streamDownloadToBlob(
	options: StreamDownloadOptions,
): Promise<{ blob: Blob; blobUrl: string }> {
	const parts: Uint8Array[] = [];
	for await (const plain of decryptedChunks(options)) {
		parts.push(plain);
	}

	const blob = new Blob(parts as unknown as BlobPart[], { type: options.meta.mime_type });
	const blobUrl = URL.createObjectURL(blob);

	options.onProgress?.({ type: "done" });
	return { blob, blobUrl };
}
