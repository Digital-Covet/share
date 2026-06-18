export type Phase = "idle" | "selecting" | "uploading" | "success" | "error";

export interface FileMetadata {
	name: string;
	size: number;
}

export interface ShareData {
	url: string;
	key: string;
}

export interface SecuritySettings {
	expiration: "24h" | "7d" | "30d" | "custom";
	customExpirationDate?: string;
	oneTimeDownload: boolean;
	maxDownloads: number | null;
}

export interface InitiateUploadResponse {
	fileId: string;
	uploadId: string | null;
	presignedUrls: { partNumber: number; url: string; expiresAt: string }[];
}

export interface CompleteUploadResponse {
	fileId: string;
	shareLink: { id: string; expiresAt: string };
}
