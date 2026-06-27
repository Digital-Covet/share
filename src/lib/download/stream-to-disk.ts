import { apiUrl } from "@/lib/api/url";
import { decryptChunk, importKeyFromBase64Url } from "@/lib/crypto";
import { deriveIV } from "@/lib/crypto/iv";
import type { FileMeta } from "./types";

function encodeAAD(
	fileId: string,
	chunkIndex: number,
	totalChunks: number,
): Uint8Array {
	return new TextEncoder().encode(JSON.stringify({ fileId, chunkIndex, totalChunks }));
}

async function fetchPresignedUrl(
	fileId: string,
	chunkIndex: number,
	preview: boolean,
	sessionId: string | undefined,
	signal?: AbortSignal,
): Promise<{ url: string; range: string; sessionId?: string }> {
	const res = await fetch(apiUrl(`/api/files/${fileId}/download-urls`), {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ chunkIndices: [chunkIndex], preview, sessionId }),
		signal,
	});

	const ct = res.headers.get("Content-Type") || "";
	if (!res.ok || !ct.includes("application/json")) {
		let msg = `Failed to get download URL for chunk ${chunkIndex} (HTTP ${res.status})`;
		if (ct.includes("application/json")) {
			const body = await res.json().catch(() => ({}));
			msg = (body as any)?.error ?? msg;
		}
		throw new Error(msg);
	}

	const body = (await res.json()) as {
		urls: { url: string; range: string }[];
		sessionId?: string;
	};
	return {
		url: body.urls[0].url,
		range: body.urls[0].range,
		sessionId: body.sessionId,
	};
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

export async function streamDownloadToDisk(
	meta: FileMeta,
	keyBase64Url: string,
	fileName: string,
	ivBase: Uint8Array,
	onProgress?: (event: StreamProgress) => void,
	signal?: AbortSignal,
): Promise<void> {
	const key = await importKeyFromBase64Url(keyBase64Url);

	const fileHandle = await window.showSaveFilePicker({
		suggestedName: fileName,
		types: [{ description: "File", accept: { "*/*": [] } }],
	});

	const writable = await fileHandle.createWritable();
	let sessionId: string | undefined;

	try {
		for (let i = 0; i < meta.total_chunks; i++) {
			if (signal?.aborted) break;

			onProgress?.({ type: "progress", chunkIndex: i, loaded: 0, total: meta.chunk_size });

			const result = await fetchPresignedUrl(meta.fileId, i, false, sessionId, signal);
			if (result.sessionId) {
				sessionId = result.sessionId;
			}

			const encrypted = await fetchChunkBytes(result.url, result.range, signal);

			onProgress?.({ type: "progress", chunkIndex: i, loaded: encrypted.byteLength, total: encrypted.byteLength });
			onProgress?.({ type: "decrypting", chunkIndex: i });

			const iv = deriveIV(ivBase, i);
			const aad = encodeAAD(meta.fileId, i, meta.total_chunks);
			const plain = await decryptChunk(key, iv, aad, encrypted);

			await writable.write(plain as unknown as BufferSource);
		}
	} finally {
		await writable.close();
	}

	onProgress?.({ type: "done" });
}

export async function streamDownloadToBlob(
	meta: FileMeta,
	keyBase64Url: string,
	fileName: string,
	ivBase: Uint8Array,
	onProgress?: (event: StreamProgress) => void,
	signal?: AbortSignal,
): Promise<{ blob: Blob; blobUrl: string }> {
	const key = await importKeyFromBase64Url(keyBase64Url);
	const parts: Uint8Array[] = [];
	let totalBytes = 0;
	let sessionId: string | undefined;

	for (let i = 0; i < meta.total_chunks; i++) {
		if (signal?.aborted) break;

		onProgress?.({ type: "progress", chunkIndex: i, loaded: 0, total: meta.chunk_size });

		const result = await fetchPresignedUrl(meta.fileId, i, false, sessionId, signal);
		if (result.sessionId) {
			sessionId = result.sessionId;
		}

		const encrypted = await fetchChunkBytes(result.url, result.range, signal);

		onProgress?.({ type: "progress", chunkIndex: i, loaded: encrypted.byteLength, total: encrypted.byteLength });
		onProgress?.({ type: "decrypting", chunkIndex: i });

		const iv = deriveIV(ivBase, i);
		const aad = encodeAAD(meta.fileId, i, meta.total_chunks);
		const plain = await decryptChunk(key, iv, aad, encrypted);

		parts.push(plain);
		totalBytes += plain.byteLength;
	}

	const merged = new Uint8Array(totalBytes);
	let offset = 0;
	for (const part of parts) {
		merged.set(part, offset);
		offset += part.byteLength;
	}

	const blob = new Blob([merged], { type: meta.mime_type });
	const blobUrl = URL.createObjectURL(blob);

	onProgress?.({ type: "done" });
	return { blob, blobUrl };
}
