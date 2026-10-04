import {
	type StreamProgress,
	streamDownloadToBlob,
	streamDownloadToDisk,
	supportsFileSystemAccess,
} from "@/lib/download/stream-to-disk";
import type { ShareTransfer } from "@/types/share";

export interface SaveTransferConfig {
	transfer: ShareTransfer;
	password: string;
	onProgress: (event: StreamProgress) => void;
	signal?: AbortSignal;
}

export type SaveOutcome = "saved" | "cancelled";

function triggerBrowserDownload(blobUrl: string, fileName: string) {
	const anchor = document.createElement("a");
	anchor.href = blobUrl;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	// Revoking immediately can cancel the download in some browsers.
	setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function saveTransfer(config: SaveTransferConfig): Promise<SaveOutcome> {
	const { transfer, password, onProgress, signal } = config;
	const options = {
		meta: {
			fileId: transfer.fileId,
			mime_type: transfer.mimeType,
			chunk_size: transfer.chunkSize,
			total_chunks: transfer.totalChunks,
		},
		keyBase64Url: transfer.keyBase64Url,
		fileName: transfer.fileName,
		ivBase: transfer.ivBase,
		password,
		onProgress,
		signal,
	};

	try {
		if (supportsFileSystemAccess()) {
			await streamDownloadToDisk(options);
		} else {
			const { blobUrl } = await streamDownloadToBlob(options);
			triggerBrowserDownload(blobUrl, transfer.fileName);
		}
		return "saved";
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
		throw error;
	}
}
