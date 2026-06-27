import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { getSignedUrl, r2 } from "@/server/r2";
import { r2FileKey, r2PartKey } from "@/server/r2-keys";
import { PRESIGN_EXPIRES } from "@/lib/constants";
import { verifyPassword } from "@/lib/crypto/password";

const BUCKET = process.env.R2_BUCKET!;

const DELETE_DELAY_MS = 5 * 60 * 1000;

const BodySchema = z.object({
	chunkIndices: z.array(z.number().int().min(0)).min(1).max(1000),
	preview: z.boolean().optional().default(false),
});

async function deleteR2Chunks(
	userId: string,
	fileId: string,
	totalChunks: number,
): Promise<string[]> {
	const errors: string[] = [];

	if (totalChunks === 1) {
		try {
			await r2.send(
				new DeleteObjectCommand({
					Bucket: BUCKET,
					Key: r2FileKey(userId, fileId),
				}),
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			errors.push(`file: ${msg}`);
		}
		return errors;
	}

	for (let i = 1; i <= totalChunks; i++) {
		try {
			await r2.send(
				new DeleteObjectCommand({
					Bucket: BUCKET,
					Key: r2PartKey(userId, fileId, i),
				}),
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			errors.push(`chunk ${i}: ${msg}`);
		}
	}
	return errors;
}

function scheduleFileDeletion(userId: string, fileId: string, totalChunks: number) {
	setTimeout(async () => {
		const deleteErrors = await deleteR2Chunks(userId, fileId, totalChunks);

		await prisma.file.update({
			where: { id: fileId },
			data: { status: "DELETED" },
		});

		if (deleteErrors.length > 0) {
			console.error(
				`Scheduled deletion: failed to delete ${deleteErrors.length} R2 chunks for file ${fileId}:`,
				deleteErrors,
			);
		}
	}, DELETE_DELAY_MS);
}

export async function POST({
	request,
	params,
}: {
	request: Request;
	params: { fileID: string };
}) {
	const { fileID } = params;

	const raw = await request.json();
	const parsed = BodySchema.safeParse(raw);
	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid payload", issues: z.treeifyError(parsed.error) },
			{ status: 422 },
		);
	}

	const { chunkIndices, preview } = parsed.data;

	const file = await prisma.file.findUnique({
		where: { id: fileID },
		select: {
			id: true,
			userId: true,
			totalChunks: true,
			chunkSize: true,
			encryptedSize: true,
			originalSize: true,
			status: true,
			expiresAt: true,
			uploadSessions: {
				select: { multipartUploadId: true },
				take: 1,
			},
			shareLinks: {
				where: { status: "ACTIVE" },
				orderBy: { createdAt: "desc" },
				take: 1,
				select: {
					id: true,
					downloadCount: true,
					isOneTime: true,
					maxDownloads: true,
					consumedAt: true,
					isPasswordProtected: true,
					passwordHash: true,
				},
			},
		},
	});

	if (!file || !file.userId) {
		return Response.json({ error: "File not found" }, { status: 404 });
	}

	const { userId } = file;
	const now = new Date();

	if (file.expiresAt && file.expiresAt <= now) {
		return Response.json({ error: "File has expired" }, { status: 410 });
	}

	if (file.status !== "READY") {
		return Response.json({ error: "File is not available" }, { status: 404 });
	}

	const link = file.shareLinks[0];
	if (!link) {
		return Response.json({ error: "No active share link" }, { status: 404 });
	}

	if (link.consumedAt) {
		return Response.json(
			{ error: "File has already been consumed" },
			{ status: 410 },
		);
	}

	if (link.maxDownloads !== null && link.downloadCount >= link.maxDownloads) {
		scheduleFileDeletion(userId, file.id, file.totalChunks);
		return Response.json({ error: "Download limit reached" }, { status: 410 });
	}

	if (link.isPasswordProtected) {
		const password = request.headers.get("x-share-password");
		if (!password) {
			return Response.json(
				{ error: "Password required", is_password_protected: true },
				{ status: 403 },
			);
		}

		const valid = await verifyPassword(password, link.passwordHash!);
		if (!valid) {
			return Response.json(
				{ error: "Invalid password", is_password_protected: true },
				{ status: 403 },
			);
		}
	}

	const outOfRange = chunkIndices.find((i) => i >= file.totalChunks);
	if (outOfRange !== undefined) {
		return Response.json(
			{
				error: `Chunk index ${outOfRange} exceeds total chunks (${file.totalChunks})`,
			},
			{ status: 400 },
		);
	}

	if (!preview) {
		if (link.isOneTime) {
			const updated = await prisma.$executeRaw`
				UPDATE share_links
				SET "consumedAt" = NOW(), "downloadCount" = "downloadCount" + 1
				WHERE id = ${link.id} AND "consumedAt" IS NULL
			`;

			if (updated === 0) {
				return Response.json(
					{ error: "File has already been consumed" },
					{ status: 410 },
				);
			}

			scheduleFileDeletion(userId, file.id, file.totalChunks);
		} else {
			const newCount = link.downloadCount + 1;
			await prisma.shareLink.update({
				where: { id: link.id },
				data: { downloadCount: { increment: 1 } },
			});

			if (link.maxDownloads !== null && newCount >= link.maxDownloads) {
				scheduleFileDeletion(userId, file.id, file.totalChunks);
			}
		}
	}

	const assembledKey = r2FileKey(userId, file.id);
	const totalEncryptedSize = Number(file.encryptedSize ?? file.originalSize);

	// AES-GCM appends a 16-byte authentication tag to each encrypted chunk,
	// so each chunk on R2 is (plaintextChunkSize + 16) bytes, except possibly the last.
	const GCM_TAG_BYTES = 16;
	const encryptedStride = file.chunkSize + GCM_TAG_BYTES;

	const urls = await Promise.all(
		chunkIndices.map(async (index) => {
			const start = index * encryptedStride;
			const end =
				index === file.totalChunks - 1
					? totalEncryptedSize - 1
					: start + encryptedStride - 1;

			const range = `bytes=${start}-${end}`;
			const command = new GetObjectCommand({
				Bucket: BUCKET,
				Key: assembledKey,
				Range: range,
			});
			const url = await getSignedUrl(r2, command, {
				expiresIn: PRESIGN_EXPIRES,
			});
			return { index, url, range };
		}),
	);

	return Response.json({ urls });
}
