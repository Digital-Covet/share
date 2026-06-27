import type { FileStatus, FileType, FileItem } from "@/types/dashboard";
import { deriveShareLinkStatus } from "./share-link";

const MIME_TO_TYPE: Record<string, FileType> = {
	"application/pdf": "pdf",
	"application/zip": "zip",
	"application/x-zip-compressed": "zip",
	"application/x-7z-compressed": "zip",
	"application/x-rar-compressed": "zip",
	"image/jpeg": "image",
	"image/png": "image",
	"image/gif": "image",
	"image/webp": "image",
	"image/svg+xml": "image",
	"image/avif": "image",
	"text/csv": "spreadsheet",
	"application/vnd.ms-excel": "spreadsheet",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		"spreadsheet",
};

function deriveFileType(mimeType: string): FileType {
	const base = mimeType.split(";")[0]?.trim() ?? "";
	if (MIME_TO_TYPE[base]) return MIME_TO_TYPE[base];
	if (base.startsWith("image/")) return "image";
	return "document";
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / 1024 ** i;
	return `${size < 10 ? size.toFixed(size < 1 ? 2 : 1) : Math.round(size)} ${units[i]}`;
}

function formatExpiryDisplay(expiresAt: Date | null): string {
	if (!expiresAt) return "Never";
	const now = new Date();
	if (expiresAt < now) {
		return expiresAt.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}
	return expiresAt.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

interface ShareLinkRow {
	id: string;
	status: "ACTIVE" | "REVOKED";
	expiresAt: Date | null;
	consumedAt: Date | null;
	downloadCount: number;
	maxDownloads: number | null;
	isOneTime: boolean;
}

interface FileRow {
	id: string;
	fileName: string;
	mimeType: string;
	originalSize: bigint;
	status: string;
	expiresAt: Date | null;
	createdAt: Date;
	shareLinks: ShareLinkRow[];
}

function deriveStatus(fileStatus: string, link: ShareLinkRow | undefined): FileStatus {
	if (fileStatus === "DELETED") return "Revoked";
	if (fileStatus === "REVOKED") return "Revoked";
	if (fileStatus === "EXPIRED") return "Expired";
	if (fileStatus === "FAILED") return "Expired";
	if (fileStatus === "PENDING") return "Pending";

	if (!link) return "Pending";
	return deriveShareLinkStatus(link);
}

export function mapFileToFileItem(file: FileRow): FileItem {
	const primaryLink = file.shareLinks[0];
	const sizeBytes = Number(file.originalSize);

	return {
		id: file.id,
		name: file.fileName,
		sizeBytes,
		sizeFormatted: formatFileSize(sizeBytes),
		status: deriveStatus(file.status, primaryLink),
		expiryDisplay: formatExpiryDisplay(primaryLink?.expiresAt ?? file.expiresAt),
		expiryTimestamp: (primaryLink?.expiresAt ?? file.expiresAt)?.getTime() ?? 0,
		downloads: primaryLink?.downloadCount ?? 0,
		type: deriveFileType(file.mimeType),
		shareLinkId: primaryLink?.id ?? null,
	};
}
