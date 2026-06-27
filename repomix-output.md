# Directory Structure
```
src/components/recieve/SecureShareViewer.tsx
src/components/upload/SecureUpload.tsx
src/lib/api/meta.ts
src/lib/crypto/decrypt.ts
src/lib/crypto/encrypt.ts
src/lib/crypto/keys.ts
src/lib/download/mse-controller.ts
src/lib/download/pipeline.ts
src/lib/download/stream-to-disk.ts
src/routes/api/files/[fileID]/download-urls.ts
src/routes/api/files/[fileID]/meta.ts
src/routes/api/files/complete-upload.ts
src/routes/api/files/initiate-upload.ts
```

# Files

## File: src/lib/api/meta.ts
```typescript
import { apiUrl } from "~/lib/api/url";
export interface FileMetaResponse {
  fileId: string;
  originalName: string;
  mimeType: string;
  originalSize: string;
  iv: string;
  ivBase?: string;
  encryptionKey?: string;
  chunkSize: number;
  totalChunks: number;
  isPasswordProtected: boolean;
  maxDownloads?: number;
  downloadCount: number;
  expiresAt: string | null;
}
export interface MetaResult {
  ok: boolean;
  status: number;
  data?: FileMetaResponse;
  error?: string;
}
export async function fetchFileMeta(
  fileId: string,
  password: string,
): Promise<MetaResult> {
  const res = await fetch(
    apiUrl(`/api/files/${encodeURIComponent(fileId)}/meta`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ password }),
      cache: "no-store",
    },
  );
  const contentType = res.headers.get("Content-Type") || "";
  const isJson = contentType.includes("application/json");
  if (!res.ok || !isJson) {
    let error = `Request failed with status ${res.status}`;
    if (isJson) {
      try {
        const body = (await res.json()) as { error?: string };
        error = body?.error ?? error;
      } catch {
      }
    } else if (contentType.includes("text/html")) {
      error = `Received HTML instead of JSON. The API endpoint may be missing or misconfigured.`;
    }
    return { ok: false, status: res.status, error };
  }
  try {
    const data = (await res.json()) as FileMetaResponse;
    return { ok: true, status: 200, data };
  } catch {
    return {
      ok: false,
      status: res.status,
      error: "Failed to parse server response as JSON.",
    };
  }
}
```

## File: src/lib/crypto/encrypt.ts
```typescript
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	const buf = new ArrayBuffer(view.byteLength);
	new Uint8Array(buf).set(view);
	return buf;
}
export async function encryptChunk(
	key: CryptoKey,
	iv: Uint8Array,
	aad: Uint8Array,
	plain: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
	const cipher = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv: toArrayBuffer(iv),
			additionalData: toArrayBuffer(aad),
			tagLength: 128,
		},
		key,
		toArrayBuffer(plain),
	);
	return new Uint8Array(cipher);
}
```

## File: src/lib/download/mse-controller.ts
```typescript
import { apiUrl } from "@/lib/api/url";
import { importKeyFromBase64Url } from "@/lib/crypto";
import { deriveIV } from "@/lib/crypto/iv";
import { decryptChunk } from "@/lib/crypto/decrypt";
import type { FileMeta } from "./types";
const INITIAL_BUFFER_CHUNKS = 6;
const BUFFER_LOW_WATERMARK = 2;
const BUFFER_HIGH_WATERMARK = 8;
const COMMON_CODECS = [
	'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
	'video/mp4; codecs="avc1.4D401E, mp4a.40.2"',
	'video/mp4; codecs="avc1.64001E, mp4a.40.2"',
	'video/mp4; codecs="hev1.1.6.L93.B0, mp4a.40.2"',
];
function probeCodec(): string {
	for (const codec of COMMON_CODECS) {
		if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(codec)) {
			return codec;
		}
	}
	return COMMON_CODECS[0];
}
function encodeAAD(fileId: string, chunkIndex: number, totalChunks: number): Uint8Array {
	return new TextEncoder().encode(JSON.stringify({ fileId, chunkIndex, totalChunks }));
}
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	const buf = new ArrayBuffer(view.byteLength);
	new Uint8Array(buf).set(view);
	return buf;
}
async function fetchAndDecrypt(
	meta: FileMeta,
	key: CryptoKey,
	ivBase: Uint8Array,
	chunkIndex: number,
	signal?: AbortSignal,
): Promise<Uint8Array> {
	const presignedRes = await fetch(apiUrl(`/api/files/${meta.fileId}/download-urls`), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ chunkIndices: [chunkIndex], preview: true }),
		signal,
	});
	if (!presignedRes.ok) {
		const body = await presignedRes.json().catch(() => ({}));
		throw new Error(body.error ?? `Failed to get download URL for chunk ${chunkIndex}`);
	}
	const { urls } = (await presignedRes.json()) as { urls: { url: string; range: string }[] };
	const [{ url, range }] = urls;
	const encRes = await fetch(url, { headers: { Range: range }, signal });
	if (!encRes.ok) throw new Error(`Failed to fetch chunk ${chunkIndex}: ${encRes.status}`);
	const encrypted = new Uint8Array(await encRes.arrayBuffer());
	const iv = deriveIV(ivBase, chunkIndex);
	const aad = encodeAAD(meta.fileId, chunkIndex, meta.total_chunks);
	return decryptChunk(key, iv, aad, encrypted);
}
export interface MseControllerOptions {
	meta: FileMeta;
	keyBase64Url: string;
	ivBase: Uint8Array;
	videoEl: HTMLVideoElement;
	onError?: (err: unknown) => void;
	onBuffering?: (buffering: boolean) => void;
}
export class MseController {
	private ms: MediaSource | null = null;
	private sb: SourceBuffer | null = null;
	private key: CryptoKey | null = null;
	private abortCtl: AbortController | null = null;
	private meta: FileMeta;
	private ivBase: Uint8Array;
	private videoEl: HTMLVideoElement;
	private onError?: (err: unknown) => void;
	private onBuffering?: (buffering: boolean) => void;
	private keyBase64Url: string;
	private appendedChunks = new Set<number>();
	private decryptedLengths: number[] = [];
	private fetching = false;
	private sourceOpen = false;
	private disposed = false;
	private userSeekTarget: number | null = null;
	constructor(opts: MseControllerOptions) {
		this.meta = opts.meta;
		this.ivBase = opts.ivBase;
		this.videoEl = opts.videoEl;
		this.onError = opts.onError;
		this.onBuffering = opts.onBuffering;
		this.keyBase64Url = opts.keyBase64Url;
	}
	async init(): Promise<void> {
		this.key = await importKeyFromBase64Url(this.keyBase64Url);
		this.ms = new MediaSource();
		this.videoEl.src = URL.createObjectURL(this.ms);
		this.ms.addEventListener("sourceopen", () => {
			this.sourceOpen = true;
			const codec = probeCodec();
			const ms = this.ms;
			if (!ms) return;
			try {
				this.sb = ms.addSourceBuffer(codec);
			} catch {
				this.onError?.(new Error(`Codec not supported: ${codec}`));
				return;
			}
			this.sb.mode = "segments";
			this.sb.addEventListener("updateend", this.onUpdateEnd);
			this.videoEl.addEventListener("seeking", this.onSeeking);
			this.fetchChunks(INITIAL_BUFFER_CHUNKS);
		});
	}
	private onUpdateEnd = () => {
		if (this.disposed) return;
		if (this.userSeekTarget !== null) {
			this.videoEl.currentTime = this.userSeekTarget;
			this.userSeekTarget = null;
		}
		this.removeOldBuffers();
		this.maybeFetchMore();
	};
	private onSeeking = () => {
		if (this.disposed || !this.sb || !this.sourceOpen) return;
		const target = this.videoEl.currentTime;
		const chunkIdx = this.timeToChunkIndex(target);
		if (chunkIdx === -1) return;
		if (this.appendedChunks.has(chunkIdx)) return;
		this.userSeekTarget = target;
		this.fetchChunks(chunkIdx, Math.min(chunkIdx + BUFFER_HIGH_WATERMARK, this.meta.total_chunks));
	};
	private timeToChunkIndex(time: number): number {
		if (this.decryptedLengths.length === 0) return 0;
		let byteOffset = 0;
		for (let i = 0; i < this.meta.total_chunks; i++) {
			const chunkLen = this.decryptedLengths[i] ?? this.meta.chunk_size;
			if (time >= 0 && byteOffset <= time * 1000) {
				if (byteOffset + chunkLen > time * 1000) {
					return i;
				}
			}
			byteOffset += chunkLen;
		}
		return this.meta.total_chunks - 1;
	}
	private fetchChunks(from: number, to?: number): void {
		if (this.fetching || this.disposed || !this.sb || !this.sourceOpen) return;
		const end = to ?? Math.min(from + BUFFER_HIGH_WATERMARK, this.meta.total_chunks);
		const indices: number[] = [];
		for (let i = from; i < end; i++) {
			if (!this.appendedChunks.has(i)) {
				indices.push(i);
			}
		}
		if (indices.length === 0) return;
		this.fetching = true;
		this.onBuffering?.(true);
		this.abortCtl = new AbortController();
		this.fetchAndAppend(indices, this.abortCtl.signal).catch((err) => {
			if (this.disposed) return;
			if (err instanceof DOMException && err.name === "AbortError") return;
			this.onError?.(err);
		}).finally(() => {
			this.fetching = false;
			this.onBuffering?.(false);
		});
	}
	private async fetchAndAppend(indices: number[], signal: AbortSignal): Promise<void> {
		for (const idx of indices) {
			if (this.disposed || signal.aborted) break;
			while (this.sb?.updating) {
				await new Promise((r) => {
					this.sb?.addEventListener("updateend", r, { once: true });
				});
				if (this.disposed || signal.aborted) return;
			}
			if (this.disposed || !this.key || !this.sb || !this.sourceOpen) return;
			const plain = await fetchAndDecrypt(this.meta, this.key, this.ivBase, idx, signal);
			if (signal.aborted) return;
			this.decryptedLengths[idx] = plain.byteLength;
			this.appendedChunks.add(idx);
			this.sb.appendBuffer(toArrayBuffer(plain));
			await new Promise<void>((resolve) => {
				const sb = this.sb;
				if (!sb) { resolve(); return; }
				sb.addEventListener("updateend", () => resolve(), { once: true });
			});
			if (this.disposed) return;
			this.removeOldBuffers();
		}
	}
	private removeOldBuffers(): void {
		if (!this.sb || this.sb.updating || this.disposed) return;
		const currentTime = this.videoEl.currentTime;
		const removeEnd = currentTime - 5;
		if (removeEnd <= 0) return;
		if (this.sb.buffered.length > 0) {
			const start = this.sb.buffered.start(0);
			if (removeEnd > start + 5) {
				try {
					this.sb.remove(start, removeEnd);
				} catch {
				}
			}
		}
	}
	private maybeFetchMore(): void {
		if (this.disposed || !this.sb || this.sb.updating) return;
		const currentTime = this.videoEl.currentTime;
		const bufferedEnd = this.getBufferedEnd();
		if (bufferedEnd - currentTime < BUFFER_LOW_WATERMARK) {
			const nextChunk = this.chunkIndexAfterTime(bufferedEnd);
			if (nextChunk < this.meta.total_chunks) {
				this.fetchChunks(nextChunk);
			}
		}
	}
	private getBufferedEnd(): number {
		if (!this.sb || this.sb.buffered.length === 0) return 0;
		return this.sb.buffered.end(this.sb.buffered.length - 1);
	}
	private chunkIndexAfterTime(time: number): number {
		let byteOffset = 0;
		for (let i = 0; i < this.meta.total_chunks; i++) {
			const chunkLen = this.decryptedLengths[i] ?? this.meta.chunk_size;
			if (byteOffset >= time * 1000) {
				return i;
			}
			byteOffset += chunkLen;
		}
		return this.meta.total_chunks;
	}
	dispose(): void {
		this.disposed = true;
		this.abortCtl?.abort();
		if (this.sb) {
			this.sb.removeEventListener("updateend", this.onUpdateEnd);
		}
		this.videoEl.removeEventListener("seeking", this.onSeeking);
		if (this.ms?.readyState === "open") {
			try {
				this.ms.endOfStream();
			} catch {
			}
		}
		if (this.videoEl.src) {
			URL.revokeObjectURL(this.videoEl.src);
			this.videoEl.removeAttribute("src");
			this.videoEl.load();
		}
		this.ms = null;
		this.sb = null;
	}
}
```

## File: src/lib/download/pipeline.ts
```typescript
import { apiUrl } from "@/lib/api/url";
import { decryptChunk, importKeyFromBase64Url } from "@/lib/crypto";
import { deriveIV } from "@/lib/crypto/iv";
import type { DownloadProgress, DownloadResult, FileMeta } from "./types";
function encodeAAD(
  fileId: string,
  chunkIndex: number,
  totalChunks: number,
): Uint8Array {
  const payload = JSON.stringify({ fileId, chunkIndex, totalChunks });
  return new TextEncoder().encode(payload);
}
function deriveIVForChunk(ivBase: Uint8Array, chunkIndex: number): Uint8Array {
  return deriveIV(ivBase, chunkIndex);
}
export function inferCategory(
  mimeType: string,
): "image" | "pdf" | "video" | "other" | "archive" {
  if (mimeType === "application/zip") return "archive";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  return "other";
}
function fileNameFromMeta(meta: FileMeta): string {
  const ext = mimeToExt(meta.mime_type);
  return `${meta.fileId}${ext}`;
}
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "application/zip": ".zip",
    "text/plain": ".txt",
    "application/json": ".json",
  };
  return map[mime] ?? ".bin";
}
async function fetchChunk(
  url: string,
  range: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { Range: range }, signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch chunk: HTTP ${res.status}`);
  }
  const contentType = res.headers.get("Content-Type") || "";
  if (contentType.includes("text/html")) {
    throw new Error("Received HTML page instead of binary chunk data.");
  }
  return new Uint8Array(await res.arrayBuffer());
}
export async function* downloadPipeline(
  meta: FileMeta,
  keyBase64Url: string,
  chunkIndices: number[],
  ivBase: Uint8Array,
  fileName: string,
  onProgress?: (event: DownloadProgress) => void,
  signal?: AbortSignal,
  preview = false,
): AsyncGenerator<DownloadProgress, DownloadResult> {
  const key = await importKeyFromBase64Url(keyBase64Url);
  const parts: Uint8Array[] = [];
  let totalBytes = 0;
  for (const index of chunkIndices) {
    onProgress?.({
      type: "progress",
      chunkIndex: index,
      loaded: 0,
      total: meta.chunk_size,
    });
    const presignedRes = await fetch(
      apiUrl(`/api/files/${meta.fileId}/download-urls`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ chunkIndices: [index], preview }),
        signal,
      },
    );
    const ct = presignedRes.headers.get("Content-Type") || "";
    const isJson = ct.includes("application/json");
    if (!presignedRes.ok || !isJson) {
      let msg = `Failed to get download URL for chunk ${index} (HTTP ${presignedRes.status})`;
      if (isJson) {
        const body = await presignedRes.json().catch(() => ({}));
        msg = (body as any)?.error ?? msg;
      } else if (ct.includes("text/html")) {
        msg = `Received HTML instead of JSON for chunk ${index} URL.`;
      }
      throw new Error(msg);
    }
    let urlsData: { urls: { index: number; url: string; range: string }[] };
    try {
      urlsData = (await presignedRes.json()) as {
        urls: { index: number; url: string; range: string }[];
      };
    } catch {
      throw new Error(`Failed to parse JSON response for chunk ${index} URL.`);
    }
    const [{ url, range }] = urlsData.urls;
    const encrypted = await fetchChunk(url, range, signal);
    onProgress?.({
      type: "progress",
      chunkIndex: index,
      loaded: encrypted.byteLength,
      total: encrypted.byteLength,
    });
    onProgress?.({ type: "decrypting", chunkIndex: index });
    const iv = deriveIVForChunk(ivBase, index);
    const aad = encodeAAD(meta.fileId, index, meta.total_chunks);
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
  const result: DownloadResult = {
    blob,
    blobUrl,
    mimeType: meta.mime_type,
    fileName: fileName || fileNameFromMeta(meta),
  };
  onProgress?.({ type: "done", result });
  return result;
}
```

## File: src/lib/download/stream-to-disk.ts
```typescript
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
	signal?: AbortSignal,
): Promise<{ url: string; range: string }> {
	const res = await fetch(apiUrl(`/api/files/${fileId}/download-urls`), {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ chunkIndices: [chunkIndex], preview }),
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
	const { urls } = (await res.json()) as { urls: { url: string; range: string }[] };
	return { url: urls[0].url, range: urls[0].range };
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
	try {
		for (let i = 0; i < meta.total_chunks; i++) {
			if (signal?.aborted) break;
			onProgress?.({ type: "progress", chunkIndex: i, loaded: 0, total: meta.chunk_size });
			const { url, range } = await fetchPresignedUrl(meta.fileId, i, false, signal);
			const encrypted = await fetchChunkBytes(url, range, signal);
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
	for (let i = 0; i < meta.total_chunks; i++) {
		if (signal?.aborted) break;
		onProgress?.({ type: "progress", chunkIndex: i, loaded: 0, total: meta.chunk_size });
		const { url, range } = await fetchPresignedUrl(meta.fileId, i, false, signal);
		const encrypted = await fetchChunkBytes(url, range, signal);
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
```

## File: src/routes/api/files/[fileID]/download-urls.ts
```typescript
import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { getSignedUrl, r2 } from "@/server/r2";
import { r2FileKey, r2PartKey } from "@/server/r2-keys";
import { PRESIGN_EXPIRES } from "@/lib/constants";
import { verifyPassword } from "@/lib/crypto/password";
const BUCKET = process.env.R2_BUCKET!;
const DELETE_DELAY_MS = 5 * 60 * 1000;
const BodySchema = z.object({
	chunkIndices: z.array(z.number().int().min(0)).min(1).max(1000),
	preview: z.boolean().optional().default(false),
});
async function deleteR2Chunks(
	userId: string,
	fileId: string,
	totalChunks: number,
): Promise<string[]> {
	const errors: string[] = [];
	if (totalChunks === 1) {
		try {
			await r2.send(
				new DeleteObjectCommand({
					Bucket: BUCKET,
					Key: r2FileKey(userId, fileId),
				}),
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			errors.push(`file: ${msg}`);
		}
		return errors;
	}
	for (let i = 1; i <= totalChunks; i++) {
		try {
			await r2.send(
				new DeleteObjectCommand({
					Bucket: BUCKET,
					Key: r2PartKey(userId, fileId, i),
				}),
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			errors.push(`chunk ${i}: ${msg}`);
		}
	}
	return errors;
}
function scheduleFileDeletion(userId: string, fileId: string, totalChunks: number) {
	setTimeout(async () => {
		const deleteErrors = await deleteR2Chunks(userId, fileId, totalChunks);
		await prisma.file.update({
			where: { id: fileId },
			data: { status: "DELETED" },
		});
		if (deleteErrors.length > 0) {
			console.error(
				`Scheduled deletion: failed to delete ${deleteErrors.length} R2 chunks for file ${fileId}:`,
				deleteErrors,
			);
		}
	}, DELETE_DELAY_MS);
}
export async function POST({
	request,
	params,
}: {
	request: Request;
	params: { fileID: string };
}) {
	const { fileID } = params;
	const raw = await request.json();
	const parsed = BodySchema.safeParse(raw);
	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid payload", issues: z.treeifyError(parsed.error) },
			{ status: 422 },
		);
	}
	const { chunkIndices, preview } = parsed.data;
	const file = await prisma.file.findUnique({
		where: { id: fileID },
		select: {
			id: true,
			userId: true,
			totalChunks: true,
			chunkSize: true,
			encryptedSize: true,
			originalSize: true,
			status: true,
			expiresAt: true,
			uploadSessions: {
				select: { multipartUploadId: true },
				take: 1,
			},
			shareLinks: {
				where: { status: "ACTIVE" },
				orderBy: { createdAt: "desc" },
				take: 1,
				select: {
					id: true,
					downloadCount: true,
					isOneTime: true,
					maxDownloads: true,
					consumedAt: true,
					isPasswordProtected: true,
					passwordHash: true,
				},
			},
		},
	});
	if (!file || !file.userId) {
		return Response.json({ error: "File not found" }, { status: 404 });
	}
	const { userId } = file;
	const now = new Date();
	if (file.expiresAt && file.expiresAt <= now) {
		return Response.json({ error: "File has expired" }, { status: 410 });
	}
	if (file.status !== "READY") {
		return Response.json({ error: "File is not available" }, { status: 404 });
	}
	const link = file.shareLinks[0];
	if (!link) {
		return Response.json({ error: "No active share link" }, { status: 404 });
	}
	if (link.consumedAt) {
		return Response.json(
			{ error: "File has already been consumed" },
			{ status: 410 },
		);
	}
	if (link.maxDownloads !== null && link.downloadCount >= link.maxDownloads) {
		scheduleFileDeletion(userId, file.id, file.totalChunks);
		return Response.json({ error: "Download limit reached" }, { status: 410 });
	}
	if (link.isPasswordProtected) {
		const password = request.headers.get("x-share-password");
		if (!password) {
			return Response.json(
				{ error: "Password required", is_password_protected: true },
				{ status: 403 },
			);
		}
		const valid = await verifyPassword(password, link.passwordHash!);
		if (!valid) {
			return Response.json(
				{ error: "Invalid password", is_password_protected: true },
				{ status: 403 },
			);
		}
	}
	const outOfRange = chunkIndices.find((i) => i >= file.totalChunks);
	if (outOfRange !== undefined) {
		return Response.json(
			{
				error: `Chunk index ${outOfRange} exceeds total chunks (${file.totalChunks})`,
			},
			{ status: 400 },
		);
	}
	if (!preview) {
		if (link.isOneTime) {
			const updated = await prisma.$executeRaw`
				UPDATE share_links
				SET "consumedAt" = NOW(), "downloadCount" = "downloadCount" + 1
				WHERE id = ${link.id} AND "consumedAt" IS NULL
			`;
			if (updated === 0) {
				return Response.json(
					{ error: "File has already been consumed" },
					{ status: 410 },
				);
			}
			scheduleFileDeletion(userId, file.id, file.totalChunks);
		} else {
			const newCount = link.downloadCount + 1;
			await prisma.shareLink.update({
				where: { id: link.id },
				data: { downloadCount: { increment: 1 } },
			});
			if (link.maxDownloads !== null && newCount >= link.maxDownloads) {
				scheduleFileDeletion(userId, file.id, file.totalChunks);
			}
		}
	}
	const assembledKey = r2FileKey(userId, file.id);
	const totalSize = Number(file.encryptedSize ?? file.originalSize);
	const urls = await Promise.all(
		chunkIndices.map(async (index) => {
			const range = `bytes=${index * file.chunkSize}-${Math.min((index + 1) * file.chunkSize - 1, totalSize - 1)}`;
			const command = new GetObjectCommand({
				Bucket: BUCKET,
				Key: assembledKey,
				Range: range,
			});
			const url = await getSignedUrl(r2, command, {
				expiresIn: PRESIGN_EXPIRES,
			});
			return { index, url, range };
		}),
	);
	return Response.json({ urls });
}
```

## File: src/routes/api/files/[fileID]/meta.ts
```typescript
import { prisma } from "@/db/project";
import type { FileMetaResponse } from "@/lib/api/meta";
import { verifyPassword } from "@/lib/crypto/password";
import { bigIntReplacer } from "@/lib/dto";
import { rateLimit } from "@/lib/rate-limit";
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;
function getClientIP(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}
function noStore(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body, bigIntReplacer), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
export async function POST({
  request,
  params,
}: {
  request: Request;
  params: { fileID: string };
}): Promise<Response> {
  const fileID = params.fileID;
  if (!fileID) {
    return noStore({ error: "Missing fileID" }, { status: 400 });
  }
  const ip = getClientIP(request);
  const rl = await rateLimit({
    key: `meta:${ip}:${fileID}`,
    limit: RATE_LIMIT_MAX,
    window: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!rl.success) {
    return noStore(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, rl.reset - Math.floor(Date.now() / 1000)),
          ),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  let body: { password?: string } = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    return noStore({ error: "Invalid JSON body" }, { status: 400 });
  }
  const link = await prisma.shareLink.findUnique({
    where: { id: fileID },
    select: {
      id: true,
      isPasswordProtected: true,
      passwordHash: true,
      maxDownloads: true,
      downloadCount: true,
      expiresAt: true,
      file: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          originalSize: true,
          ivBaseHash: true,
          ivBase: true,
          encryptionKey: true,
          chunkSize: true,
          totalChunks: true,
        },
      },
    },
  });
  console.log("PARAM", fileID);
  console.log("LINK", link);
  console.log("FILE", link?.file);
  if (!link || !link.file) {
    return noStore({ error: "Not found" }, { status: 404 });
  }
  if (link.isPasswordProtected) {
    if (!link.passwordHash) {
      console.error(
        `[meta] DB inconsistency: shareLink ${fileID} isPasswordProtected=true but passwordHash is null`,
      );
      return noStore({ error: "Server error" }, { status: 500 });
    }
    const password = typeof body.password === "string" ? body.password : "";
    const ok = await verifyPassword(password, link.passwordHash);
    if (!ok) {
      return noStore(
        { error: "Invalid password" },
        {
          status: 401,
          headers: { "X-RateLimit-Remaining": String(rl.remaining) },
        },
      );
    }
  }
  const response: FileMetaResponse = {
    fileId: link.file.id,
    originalName: link.file.fileName,
    mimeType: link.file.mimeType,
    originalSize: link.file.originalSize.toString(),
    iv: link.file.ivBaseHash,
    ivBase: link.file.ivBase ?? undefined,
    encryptionKey: link.file.encryptionKey ?? undefined,
    chunkSize: link.file.chunkSize,
    totalChunks: link.file.totalChunks,
    isPasswordProtected: link.isPasswordProtected,
    maxDownloads: link.maxDownloads ?? undefined,
    downloadCount: link.downloadCount,
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
  };
  return new Response(JSON.stringify(response, bigIntReplacer), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-RateLimit-Remaining": String(rl.remaining),
    },
  });
}
```

## File: src/components/recieve/SecureShareViewer.tsx
```typescript
import { Download, Loader2, Shield, ShieldCheck } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { ActionButton } from "@/components/recieve/ActionButton";
import { ExtractedFiles } from "@/components/recieve/ExtractedFiles";
import { FileInfoPanel } from "@/components/recieve/FileInfoPanel";
import { IconSpan } from "@/components/recieve/IconSpan";
type ViewerState = "ready" | "decrypting" | "extracted";
export default function SecureShareViewer() {
	const [state, setState] = createSignal<ViewerState>("ready");
	const handleUnlock = () => {
		setState("decrypting");
		setTimeout(() => {
			setState("extracted");
		}, 2000);
	};
	return (
		<div class="bg-grid-pattern relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-8 text-foreground">
			<div class="pointer-events-none absolute inset-x-0 top-0 h-[512px] bg-gradient-to-b from-primary/10 via-background/50 to-background" />
			<div class="z-10 mb-8 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-lg">
					<IconSpan icon={Shield} class="h-6 w-6 text-primary" />
				</div>
				<span class="font-heading text-2xl font-bold tracking-tight">
					SecureShare
				</span>
			</div>
			<div class="relative z-10 w-full max-w-[460px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
				<div class="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
				<div class="flex min-h-[360px] flex-col p-8">
				<div class="mb-6 flex items-center gap-2 text-muted-foreground">
					<IconSpan icon={Shield} class="h-4 w-4" />
					<span class="text-label">Secure File Transfer</span>
				</div>
					<Show when={state() !== "extracted"}>
						<FileInfoPanel />
					</Show>
					<Show when={state() === "extracted"}>
						<ExtractedFiles viewMode="list" selected={new Set<string>()} onToggleSelect={() => {}} onSelectAll={() => {}} onClearSelection={() => {}} />
					</Show>
					<div class="mt-auto">
						<Show
							when={state() !== "extracted"}
							fallback={
								<ActionButton
									icon={Download}
									label="Download Entire Bundle"
									secondary
								/>
							}
						>
						<ActionButton
							icon={state() === "decrypting" ? Loader2 : ShieldCheck}
							label={
								state() === "decrypting"
									? "Extracting..."
									: "Extract Files"
							}
							disabled={state() === "decrypting"}
							loading={state() === "decrypting"}
							onClick={handleUnlock}
						/>
						</Show>
					</div>
				</div>
			</div>
		</div>
	);
}
```

## File: src/lib/crypto/decrypt.ts
```typescript
export class InvalidLinkError extends Error {
	readonly name = "InvalidLinkError";
	constructor() {
		super("Invalid link");
	}
}
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	const buf = new ArrayBuffer(view.byteLength);
	new Uint8Array(buf).set(view);
	return buf;
}
export async function decryptChunk(
	key: CryptoKey,
	iv: Uint8Array,
	aad: Uint8Array,
	cipher: Uint8Array,
): Promise<Uint8Array> {
	try {
		const plain = await crypto.subtle.decrypt(
			{
				name: "AES-GCM",
				iv: toArrayBuffer(iv),
				additionalData: toArrayBuffer(aad),
				tagLength: 128,
			},
			key,
			toArrayBuffer(cipher),
		);
		return new Uint8Array(plain);
	} catch {
		throw new InvalidLinkError();
	}
}
```

## File: src/lib/crypto/keys.ts
```typescript
const ALGORITHM: AesKeyGenParams = {
	name: "AES-GCM",
	length: 256,
};
const KEY_USAGES: KeyUsage[] = ["encrypt", "decrypt"];
export async function generateMasterKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey(ALGORITHM, true, KEY_USAGES);
}
export function bufferToBase64Url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}
export function base64UrlToBuffer(base64url: string): ArrayBuffer {
	const padded = base64url.replaceAll("-", "+").replaceAll("_", "/");
	const padLen = (4 - (padded.length % 4)) % 4;
	const binary = padded + "=".repeat(padLen);
	const binaryString = atob(binary);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}
export async function exportKeyToBase64Url(key: CryptoKey): Promise<string> {
	const raw = await crypto.subtle.exportKey("raw", key);
	return bufferToBase64Url(raw);
}
export async function importKeyFromBase64Url(
	base64url: string,
): Promise<CryptoKey> {
	const raw = base64UrlToBuffer(base64url);
	return crypto.subtle.importKey("raw", raw, ALGORITHM, true, KEY_USAGES);
}
```

## File: src/routes/api/files/complete-upload.ts
```typescript
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { r2 } from "@/server/r2";
import { calculateExpiry, SecuritySettingsSchema } from "./_shared";
const BUCKET = process.env.R2_BUCKET!;
const BodySchema = z.object({
  fileId: z.string().min(1),
  encrypted_size: z.number().int().positive(),
  etags: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        etag: z.string().min(1),
      }),
    )
    .min(1),
  security_settings: SecuritySettingsSchema,
});
export async function POST({ request }: { request: Request }) {
  const user = await requireUser(request);
  const raw = await request.json();
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", issues: z.treeifyError(parsed.error) },
      { status: 422 },
    );
  }
  const { fileId, encrypted_size, etags, security_settings } = parsed.data;
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { uploadSessions: { where: { status: { not: "COMPLETED" } } } },
  });
  if (!file || file.userId !== user.id) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }
  if (file.status !== "PENDING") {
    return Response.json(
      { error: "File is not in pending state" },
      { status: 409 },
    );
  }
  const session = file.uploadSessions[0];
  if (!session?.multipartUploadId) {
    return Response.json(
      { error: "No active upload session" },
      { status: 409 },
    );
  }
  const sortedParts = [...etags].sort((a, b) => a.partNumber - b.partNumber);
  const completeCmd = new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: file.r2Key,
    UploadId: session.multipartUploadId,
    MultipartUpload: {
      Parts: sortedParts.map((e) => ({
        PartNumber: e.partNumber,
        ETag: e.etag,
      })),
    },
  });
  await r2.send(completeCmd);
  const linkExpiresAt = calculateExpiry(security_settings);
  const [updatedFile, shareLink] = await prisma.$transaction([
    prisma.file.update({
      where: { id: fileId },
      data: {
        status: "READY",
        encryptedSize: BigInt(encrypted_size),
        expiresAt: linkExpiresAt,
      },
    }),
    prisma.uploadSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        completedPartEtags: JSON.stringify(etags),
        completedAt: new Date(),
      },
    }),
    prisma.shareLink.create({
      data: {
        fileId,
        expiresAt: linkExpiresAt,
        isOneTime: security_settings.oneTimeDownload,
        maxDownloads: security_settings.maxDownloads,
      },
    }),
  ]);
  return Response.json({
    fileId: updatedFile.id,
    status: updatedFile.status,
    encryptedSize: updatedFile.encryptedSize?.toString() ?? null,
    shareLink: {
      id: shareLink.id,
      expiresAt: shareLink.expiresAt?.toISOString() ?? null,
    },
  });
}
```

## File: src/routes/api/files/initiate-upload.ts
```typescript
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { getSignedUrl, r2 } from "@/server/r2";
import { r2FileKey } from "@/server/r2-keys";
import { PRESIGN_EXPIRES } from "@/lib/constants";
const BUCKET = process.env.R2_BUCKET!;
const MULTIPART_BATCH = 5;
const MAX_FILE_SIZE = Math.floor(9.9 * 1024 * 1024 * 1024);
const BodySchema = z.object({
  file_name: z.string().min(1).max(1024),
  mime_type: z.string().min(1),
  original_size: z.number().int().positive().max(MAX_FILE_SIZE, `File size must not exceed 9.9 GB`),
  total_chunks: z.number().int().positive(),
  iv_base_hash: z.string().min(1),
  encryption_key: z.string().min(1),
  iv_base: z.string().min(1),
});
export async function POST({ request }: { request: Request }) {
  const user = await requireUser(request);
  const raw = await request.json();
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", issues: z.treeifyError(parsed.error) },
      { status: 422 },
    );
  }
  const { file_name, mime_type, original_size, total_chunks, iv_base_hash, encryption_key, iv_base } =
    parsed.data;
  const fileId = crypto.randomUUID();
  const r2Key = r2FileKey(user.id, fileId);
  const createCmd = new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: r2Key,
    ContentType: mime_type,
  });
  const multipart = await r2.send(createCmd);
  const file = await prisma.file.create({
    data: {
      id: fileId,
      userId: user.id,
      fileName: file_name,
      mimeType: mime_type,
      originalSize: BigInt(original_size),
      totalChunks: total_chunks,
      ivBaseHash: iv_base_hash,
      ivBase: iv_base,
      encryptionKey: encryption_key,
      r2Key,
      status: "PENDING",
    },
  });
  const session = await prisma.uploadSession.create({
    data: {
      fileId: file.id,
      multipartUploadId: multipart.UploadId!,
      status: "INITIATED",
      totalParts: total_chunks,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const batch = Math.min(MULTIPART_BATCH, total_chunks);
  const urls = await Promise.all(
    Array.from({ length: batch }, (_, i) => {
      const partNumber = i + 1;
      const cmd = new UploadPartCommand({
        Bucket: BUCKET,
        Key: r2Key,
        PartNumber: partNumber,
        UploadId: multipart.UploadId!,
      });
      return getSignedUrl(r2, cmd, { expiresIn: PRESIGN_EXPIRES }).then(
        (url) => ({
          partNumber,
          url,
          expiresAt: new Date(
            Date.now() + PRESIGN_EXPIRES * 1000,
          ).toISOString(),
        }),
      );
    }),
  );
  return Response.json({
    fileId: file.id,
    uploadId: session.id,
    presignedUrls: urls,
  });
}
```

## File: src/components/upload/SecureUpload.tsx
```typescript
import { type Component, createSignal, Show } from "solid-js";
import { apiUrl } from "@/lib/api/url";
import { createZip } from "@/lib/compression";
import {
  deriveIV,
  encryptChunk,
  exportKeyToBase64Url,
  generateMasterKey,
  hashIVBase,
  bufferToBase64Url,
} from "@/lib/crypto";
import type {
  FileMetadata,
  InitiateUploadResponse,
  Phase,
  SecuritySettings,
  ShareData,
} from "@/types/upload";
import { MAX_FILE_SIZE } from "@/lib/constants";
import { CHUNK_SIZE, formatFileSize, getTotalChunks } from "@/utils/upload";
import DropZone from "./DropZone";
import SettingsPanel from "./SettingsPanel";
import UploadProgress from "./UploadProgress";
import UploadSuccess from "./UploadSuccess";
const REFRESH_BUFFER_MS = 5000;
const REFRESH_CHECK_INTERVAL_MS = 1000;
const DEFAULT_SETTINGS: SecuritySettings = {
  expiration: "24h",
  oneTimeDownload: false,
  maxDownloads: 10,
};
interface SelectedFile {
  meta: FileMetadata;
  raw: File;
}
interface UploadedFile {
  shareLinkId: string;
  meta: FileMetadata;
}
function encodeAAD(
  fileId: string,
  chunkIndex: number,
  totalChunks: number,
): Uint8Array {
  const payload = JSON.stringify({ fileId, chunkIndex, totalChunks });
  return new TextEncoder().encode(payload);
}
const SecureUpload: Component = () => {
  const [phase, setPhase] = createSignal<Phase>("idle");
  const [selectedFiles, setSelectedFiles] = createSignal<SelectedFile[]>([]);
  const [uploadProgress, setUploadProgress] = createSignal(0);
  const [currentFileIndex, setCurrentFileIndex] = createSignal(0);
  const [currentArchiveName, setCurrentArchiveName] = createSignal("");
  const [uploadedFiles, setUploadedFiles] = createSignal<UploadedFile[]>([]);
  const [settings, setSettings] =
    createSignal<SecuritySettings>(DEFAULT_SETTINGS);
  const [archiveSize, setArchiveSize] = createSignal(0);
  const [fileSizeError, setFileSizeError] = createSignal<string | null>(null);
  const currentFileName = () => {
    const files = selectedFiles();
    const idx = currentFileIndex();
    return files[idx]?.meta.name ?? "";
  };
  const totalFiles = () => selectedFiles().length;
  const uploadedSize = () =>
    Math.floor((archiveSize() * uploadProgress()) / 100);
  const totalSize = () => archiveSize() || selectedFiles().reduce((sum, f) => sum + f.meta.size, 0);
  const uploadedTotalSize = () => uploadedSize();
  const handleFilesSelect = (files: File[]) => {
    setFileSizeError(null);
    const oversized = files.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setFileSizeError(
        `"${oversized.name}" exceeds the ${formatFileSize(MAX_FILE_SIZE)} limit.`,
      );
      return;
    }
    const newSelected = files.map((file) => ({
      meta: { name: file.name, size: file.size },
      raw: file,
    }));
    setSelectedFiles((prev) => [...prev, ...newSelected]);
    if (phase() === "idle") setPhase("selecting");
  };
  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFiles().length === 0) setPhase("idle");
  };
  const handleReset = () => {
    setSelectedFiles([]);
    setUploadProgress(0);
    setCurrentFileIndex(0);
    setCurrentArchiveName("");
    setArchiveSize(0);
    setUploadedFiles([]);
    setFileSizeError(null);
    setPhase("idle");
  };
  const handleUpload = async () => {
    const files = selectedFiles();
    if (files.length === 0) return;
    setPhase("uploading");
    setUploadProgress(0);
    setCurrentFileIndex(0);
    setUploadedFiles([]);
    const currentSettings = settings();
    try {
      const isSingleFile = files.length === 1;
      const archiveName = isSingleFile ? files[0].meta.name : "files.zip";
      setCurrentArchiveName(archiveName);
      let source: Blob;
      let mimeType: string;
      let archiveSize: number;
      if (isSingleFile) {
        source = files[0].raw;
        mimeType = files[0].raw.type || "application/octet-stream";
        archiveSize = files[0].raw.size;
      } else {
        const fileData = await Promise.all(
          files.map(async ({ meta, raw }) => ({
            name: meta.name,
            data: new Uint8Array(await raw.arrayBuffer()),
          })),
        );
        const archive = await createZip(fileData);
        source = new Blob([archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as BlobPart]);
        mimeType = "application/zip";
        archiveSize = archive.byteLength;
      }
      setArchiveSize(archiveSize);
      const totalChunks = getTotalChunks(archiveSize);
      const masterKey = await generateMasterKey();
      const ivBase = new Uint8Array(12);
      crypto.getRandomValues(ivBase);
      const ivBaseHash = await hashIVBase(ivBase);
      const keyBase64Url = await exportKeyToBase64Url(masterKey);
      const initRes = await fetch(apiUrl("/api/files/initiate-upload"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: archiveName,
          mime_type: mimeType,
          original_size: archiveSize,
          total_chunks: totalChunks,
          iv_base_hash: ivBaseHash,
          encryption_key: keyBase64Url,
          iv_base: bufferToBase64Url(ivBase.buffer as ArrayBuffer),
        }),
      });
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => null);
        throw new Error(err?.error ?? "Init failed");
      }
      const { fileId, uploadId, presignedUrls }: InitiateUploadResponse =
        await initRes.json();
      const etags: { partNumber: number; etag: string }[] = [];
      let totalEncryptedSize = 0;
      const urls = presignedUrls.map((entry) => ({ ...entry }));
      const refreshUrls = async (partNumbers: number[]) => {
        if (partNumbers.length === 0) return;
        const qs = new URLSearchParams({ fileId });
        for (const p of partNumbers) qs.append("parts", String(p));
        try {
          const res = await fetch(apiUrl(`/api/files/resume-upload?${qs}`));
          if (!res.ok) return;
          const { presignedUrls: fresh } = await res.json();
          for (const freshUrl of fresh) {
            const target = urls.find(
              (u) => u.partNumber === freshUrl.partNumber,
            );
            if (target) {
              target.url = freshUrl.url;
              target.expiresAt = freshUrl.expiresAt;
            }
          }
        } catch {
        }
      };
      const refreshTimer = setInterval(() => {
        const now = Date.now();
        const stale = urls
          .filter(
            (u) => new Date(u.expiresAt).getTime() - now < REFRESH_BUFFER_MS,
          )
          .map((u) => u.partNumber);
        if (stale.length > 0) void refreshUrls(stale);
      }, REFRESH_CHECK_INTERVAL_MS);
      try {
        for (let i = 0; i < urls.length; i++) {
          const { partNumber, url } = urls[i];
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, archiveSize);
          const slice = source.slice(start, end);
          const chunk = new Uint8Array(await slice.arrayBuffer());
          const iv = deriveIV(ivBase, i);
          const aad = encodeAAD(fileId, i, urls.length);
          const encrypted = await encryptChunk(masterKey, iv, aad, chunk);
          totalEncryptedSize += encrypted.byteLength;
          const chunkRes = await fetch(url, {
            method: "PUT",
            body: encrypted,
          });
          if (!chunkRes.ok)
            throw new Error(`Chunk ${partNumber} upload failed`);
          const etag = chunkRes.headers.get("ETag");
          if (!etag) throw new Error("Missing ETag");
          etags.push({ partNumber, etag });
          setUploadProgress(Math.floor(((i + 1) / urls.length) * 100));
        }
      } finally {
        clearInterval(refreshTimer);
      }
      const isMultipart = uploadId !== null;
      const completeRes = await fetch(
        apiUrl(isMultipart ? "/api/files/complete-upload" : "/api/files/finalize"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId,
            encrypted_size: totalEncryptedSize,
            ...(isMultipart ? { etags } : {}),
            security_settings: currentSettings,
          }),
        },
      );
      if (!completeRes.ok) throw new Error("Finalize failed");
      const completeData: {
        shareLink: { id: string; expiresAt: string | null };
      } = await completeRes.json();
      const archiveMeta: FileMetadata = {
        name: archiveName,
        size: archiveSize,
      };
      setUploadedFiles([
        { shareLinkId: completeData.shareLink.id, meta: archiveMeta },
      ]);
      setUploadProgress(100);
      setPhase("success");
    } catch (error) {
      console.error("Upload failed:", error);
      setPhase("error");
    }
  };
  const handleCancel = () => {
    handleReset();
  };
  const isSettingsPanelLocked = () =>
    phase() === "uploading" || phase() === "success";
  const shareDataList = (): ShareData[] => {
    return uploadedFiles().map((f) => ({
      url: `${window.location.origin}/s/${f.shareLinkId}`,
    }));
  };
  return (
    <div class="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader />
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div class="lg:col-span-8 flex flex-col gap-6">
          <Show when={phase() === "idle" || phase() === "selecting"}>
            <DropZone
              onFilesSelect={handleFilesSelect}
              selectedFiles={selectedFiles().map((f) => f.meta)}
              onRemoveFile={handleRemoveFile}
              onReset={handleReset}
              disabled={phase() === "uploading"}
            />
          </Show>
          <Show when={fileSizeError()}>
            <div class="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {fileSizeError()}
            </div>
          </Show>
          <Show when={phase() === "uploading"}>
            <UploadProgress
              fileName={currentArchiveName() || currentFileName()}
              progress={uploadProgress()}
              uploadedSize={uploadedTotalSize()}
              totalSize={totalSize()}
              currentFileIndex={0}
              totalFiles={1}
              onCancel={handleCancel}
            />
          </Show>
          <Show when={phase() === "success" && uploadedFiles().length > 0}>
            <UploadSuccess
              shareDataList={shareDataList()}
              uploadedFiles={uploadedFiles().map((f) => f.meta)}
              onNewUpload={handleReset}
            />
          </Show>
        </div>
        <div class="lg:col-span-4">
          <SettingsPanel
            settings={settings()}
            onSettingsChange={setSettings}
            onUpload={handleUpload}
            disabled={isSettingsPanelLocked()}
            canUpload={phase() === "selecting"}
          />
        </div>
      </div>
    </div>
  );
};
const PageHeader: Component = () => (
  <div class="mb-8">
    <h2 class="font-heading font-bold text-foreground tracking-tight">
      Secure Upload
    </h2>
    <p class="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
      Encrypted file sharing for sensitive data. Files are encrypted before
      upload and stored securely.
    </p>
  </div>
);
export default SecureUpload;
```
