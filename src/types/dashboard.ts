export type FileStatus = "Active" | "One-Time" | "Pending" | "Expired";
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
}

export interface DashboardStats {
	activeLinks: number;
	totalDownloads: number;
	storageUsedGB: number;
}
