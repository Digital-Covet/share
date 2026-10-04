export type Phase = "idle" | "selecting" | "uploading" | "success" | "error";

export type UploadPhase = "idle" | "staged" | "encrypting" | "success";

export type ChunkStatus =
	| "pending"
	| "encrypting"
	| "uploading"
	| "committed"
	| "failed";

export type ExpirationPreset = "24h" | "7d" | "30d" | "custom";

export interface FileMetadata {
	name: string;
	size: number;
}

export interface ShareData {
	url: string;
}

export interface SecuritySettings {
	expiration: ExpirationPreset;
	customExpirationDate?: string;
	oneTimeDownload: boolean;
	maxDownloads: number | null;
}

export interface PasswordOption {
	enabled: boolean;
	value: string;
}

export interface AccessSettings {
	expiration: ExpirationPreset;
	customExpiration: string;
	downloadLimit: number | null;
	password: PasswordOption;
}

export interface StagedFile {
	id: string;
	file: File;
}

export interface UploadReceipt {
	shareUrl: string;
	password: string | null;
}

export interface InitiateUploadResponse {
	fileId: string;
	uploadId: string | null;
	presignedUrls: { partNumber: number; url: string; expiresAt: string }[];
}

export interface CompleteUploadResponse {
	fileId: string;
	status: string;
	encryptedSize: string | null;
	shareLink: { id: string; expiresAt: string | null };
}
