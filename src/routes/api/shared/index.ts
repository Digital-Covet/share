import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { toJsonSafe } from "@/lib/dto";

function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / 1024 ** i;
	return `${size < 10 ? size.toFixed(size < 1 ? 2 : 1) : Math.round(size)} ${units[i]}`;
}

const MIME_TO_CATEGORY: Record<string, string> = {
	"application/pdf": "PDF",
	"application/zip": "Archive",
	"application/x-zip-compressed": "Archive",
	"application/x-7z-compressed": "Archive",
	"application/x-rar-compressed": "Archive",
	"image/jpeg": "Image",
	"image/png": "Image",
	"image/gif": "Image",
	"image/webp": "Image",
	"image/svg+xml": "Image",
	"image/avif": "Image",
	"text/csv": "Spreadsheet",
	"application/vnd.ms-excel": "Spreadsheet",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Spreadsheet",
	"text/plain": "Text",
};

function deriveCategory(mimeType: string): string {
	const base = mimeType.split(";")[0]?.trim() ?? "";
	return MIME_TO_CATEGORY[base] ?? "File";
}

export async function GET({ request }: { request: Request }) {
	const user = await requireUser(request);

	const shareLinks = await prisma.shareLink.findMany({
		where: {
			file: { userId: user.id },
			status: "ACTIVE",
		},
		select: {
			id: true,
			createdAt: true,
			downloadCount: true,
			file: {
				select: {
					fileName: true,
					mimeType: true,
					originalSize: true,
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

	const items = shareLinks.map((link) => {
		const sizeBytes = Number(link.file.originalSize);
		return {
			id: link.id,
			name: link.file.fileName,
			type: deriveCategory(link.file.mimeType),
			size: formatFileSize(sizeBytes),
			sizeBytes,
			receivedDate: link.createdAt.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			}),
			downloads: link.downloadCount,
		};
	});

	return Response.json(toJsonSafe({ files: items }));
}
