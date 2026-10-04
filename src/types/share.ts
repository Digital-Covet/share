export type UnavailableReason = "expired" | "revoked" | "consumed" | "not_found";

export type SharePhase =
	| "loading"
	| "password"
	| "ready"
	| "downloading"
	| "complete"
	| "unavailable"
	| "error";

export interface ShareTransfer {
	fileId: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	chunkSize: number;
	totalChunks: number;
	keyBase64Url: string;
	ivBase: Uint8Array;
	expiresAt: number | null;
	remainingDownloads: number | null;
}
