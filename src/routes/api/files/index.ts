import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { mapFileToFileItem } from "@/lib/file-map";
import { toJsonSafe } from "@/lib/dto";

export async function GET({ request }: { request: Request }) {
	const user = await requireUser(request);

	const files = await prisma.file.findMany({
		where: { userId: user.id },
		select: {
			id: true,
			fileName: true,
			mimeType: true,
			originalSize: true,
			status: true,
			expiresAt: true,
			createdAt: true,
			shareLinks: {
				where: { status: "ACTIVE" },
				orderBy: { createdAt: "desc" },
				take: 1,
				select: {
					id: true,
					status: true,
					expiresAt: true,
					consumedAt: true,
					downloadCount: true,
					maxDownloads: true,
					isOneTime: true,
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

	const items = files.map(mapFileToFileItem);

	return Response.json(toJsonSafe({ files: items }));
}
