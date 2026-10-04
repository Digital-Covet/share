import {
	FileArchive,
	FileImage,
	FileSpreadsheet,
	FileText,
	FileVideo,
} from "lucide-solid";

const ARCHIVE_MIMES = new Set([
	"application/zip",
	"application/x-zip-compressed",
	"application/x-7z-compressed",
	"application/x-rar-compressed",
]);

const SPREADSHEET_MIMES = new Set([
	"text/csv",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function fileIconFor(file: Pick<File, "name" | "type">) {
	if (ARCHIVE_MIMES.has(file.type) || file.name.endsWith(".zip")) return FileArchive;
	if (file.type.startsWith("image/")) return FileImage;
	if (file.type.startsWith("video/")) return FileVideo;
	if (SPREADSHEET_MIMES.has(file.type)) return FileSpreadsheet;
	return FileText;
}
