export interface FileMeta {
	fileId: string;
	mime_type: string;
	chunk_size: number;
	total_chunks: number;
}

export interface DownloadResult {
	blob: Blob;
	blobUrl: string;
	mimeType: string;
	fileName: string;
}

export type DownloadProgress =
	| { type: "progress"; chunkIndex: number; loaded: number; total: number }
	| { type: "decrypting"; chunkIndex: number }
	| { type: "done"; result: DownloadResult }
	| { type: "error"; error: unknown };
