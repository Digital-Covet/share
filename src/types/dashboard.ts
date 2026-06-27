export type FileStatus =
	| "Active"
	| "One-Time"
	| "Pending"
	| "Expired"
	| "Consumed"
	| "Revoked"
	| "Deleted";
export type FileType = "pdf" | "zip" | "document" | "image" | "spreadsheet";

export interface FileItem {
	id: string;
	name: string;
	sizeBytes: number;
	sizeFormatted: string;
	status: FileStatus;
	expiryDisplay: string;
	expiryTimestamp: number;
	downloads: number;
	type: FileType;
	shareLinkId: string | null;
}

export interface DashboardStats {
	activeLinks: number;
	totalDownloads: number;
	storageUsedGB: number;
}
