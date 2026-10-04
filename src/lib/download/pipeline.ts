import { decryptChunk, importKeyFromBase64Url } from "@/lib/crypto";
import { deriveIV } from "@/lib/crypto/iv";
import { fetchPresignedUrl } from "./presign";
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

  // Prevent passing HTML error pages to the decrypter
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
	let sessionId: string | undefined;

	for (const index of chunkIndices) {
		onProgress?.({
			type: "progress",
			chunkIndex: index,
			loaded: 0,
			total: meta.chunk_size,
		});

		const presigned = await fetchPresignedUrl({
			fileId: meta.fileId,
			chunkIndex: index,
			preview,
			sessionId,
			signal,
		});
		sessionId = presigned.sessionId ?? sessionId;

		const encrypted = await fetchChunk(presigned.url, presigned.range, signal);

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
