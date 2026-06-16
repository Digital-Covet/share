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
	expiration: string;
	oneTimeDownload: boolean;
	maxDownloads: number | null;
}
