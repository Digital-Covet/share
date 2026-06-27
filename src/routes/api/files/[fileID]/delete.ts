import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { r2 } from "@/server/r2";
import { r2FileKey, r2PartKey } from "@/server/r2-keys";

const BUCKET = process.env.R2_BUCKET!;

export async function POST({
	request,
	params,
}: {
	request: Request;
	params: { fileID: string };
}) {
	const user = await requireUser(request);
	const { fileID } = params;

	const file = await prisma.file.findUnique({
		where: { id: fileID },
		select: {
			id: true,
			userId: true,
			status: true,
			totalChunks: true,
		},
	});

	if (!file || file.userId !== user.id) {
		return Response.json({ error: "File not found" }, { status: 404 });
	}

	if (file.status === "DELETED" || file.status === "REVOKED") {
		return Response.json({ error: "File already deleted" }, { status: 410 });
	}

	const deleteErrors: string[] = [];
	if (file.userId) {
		if (file.totalChunks === 1) {
			try {
				await r2.send(
					new DeleteObjectCommand({
						Bucket: BUCKET,
						Key: r2FileKey(file.userId, file.id),
					}),
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				deleteErrors.push(`file: ${msg}`);
			}
		} else {
			for (let i = 1; i <= file.totalChunks; i++) {
				try {
					await r2.send(
						new DeleteObjectCommand({
							Bucket: BUCKET,
							Key: r2PartKey(file.userId, file.id, i),
						}),
					);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					deleteErrors.push(`chunk ${i}: ${msg}`);
				}
			}
		}
	}

	await prisma.$transaction([
		prisma.shareLink.updateMany({
			where: { fileId: file.id, status: "ACTIVE" },
			data: { status: "REVOKED", revokedAt: new Date() },
		}),
		prisma.file.update({
			where: { id: file.id },
			data: { status: "DELETED" },
		}),
	]);

	if (deleteErrors.length > 0) {
		console.error(
			`Delete file: failed to delete ${deleteErrors.length} R2 chunks for file ${file.id}:`,
			deleteErrors,
		);
	}

	return Response.json({ ok: true });
}
