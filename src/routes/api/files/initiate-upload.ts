import {
	CreateMultipartUploadCommand,
	PutObjectCommand,
	UploadPartCommand,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { r2, getSignedUrl } from "@/server/r2";
import { r2FileKey } from "@/server/r2-keys";

const BUCKET = process.env.R2_BUCKET!;
const PRESIGN_EXPIRES = 60;
const MULTIPART_BATCH = 5;
const SINGLE_PUT_THRESHOLD = 50 * 1024 * 1024;

const BodySchema = z.object({
	file_name: z.string().min(1).max(1024),
	mime_type: z.string().min(1),
	original_size: z.number().int().positive(),
	total_chunks: z.number().int().positive(),
	iv_base_hash: z.string().min(1),
});

export async function POST({ request }: { request: Request }) {
	const user = await requireUser(request);

	const raw = await request.json();
	const parsed = BodySchema.safeParse(raw);
	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid payload", issues: parsed.error.flatten() },
			{ status: 422 },
		);
	}

	const { file_name, mime_type, original_size, total_chunks, iv_base_hash } =
		parsed.data;

	const fileId = crypto.randomUUID();
	const r2Key = r2FileKey(user.id, fileId);

	if (original_size < SINGLE_PUT_THRESHOLD) {
		const command = new PutObjectCommand({
			Bucket: BUCKET,
			Key: r2Key,
			ContentType: mime_type,
		});

		const url = await getSignedUrl(r2, command, { expiresIn: PRESIGN_EXPIRES });
		const presignExpiresAt = new Date(Date.now() + PRESIGN_EXPIRES * 1000);

		const file = await prisma.file.create({
			data: {
				id: fileId,
				userId: user.id,
				fileName: file_name,
				mimeType: mime_type,
				originalSize: BigInt(original_size),
				totalChunks: total_chunks,
				ivBaseHash: iv_base_hash,
				r2Key,
				status: "PENDING",
			},
		});

		return Response.json({
			fileId: file.id,
			uploadId: null,
			presignedUrls: [{ partNumber: 1, url, expiresAt: presignExpiresAt.toISOString() }],
		});
	}

	const createCmd = new CreateMultipartUploadCommand({
		Bucket: BUCKET,
		Key: r2Key,
		ContentType: mime_type,
	});

	const multipart = await r2.send(createCmd);

	const file = await prisma.file.create({
		data: {
			id: fileId,
			userId: user.id,
			fileName: file_name,
			mimeType: mime_type,
			originalSize: BigInt(original_size),
			totalChunks: total_chunks,
			ivBaseHash: iv_base_hash,
			r2Key,
			status: "PENDING",
		},
	});

	const session = await prisma.uploadSession.create({
		data: {
			fileId: file.id,
			multipartUploadId: multipart.UploadId!,
			status: "INITIATED",
			totalParts: total_chunks,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
		},
	});

	const batch = Math.min(MULTIPART_BATCH, total_chunks);
	const urls = await Promise.all(
		Array.from({ length: batch }, (_, i) => {
			const partNumber = i + 1;
			const cmd = new UploadPartCommand({
				Bucket: BUCKET,
				Key: r2Key,
				PartNumber: partNumber,
				UploadId: multipart.UploadId!,
			});
			return getSignedUrl(r2, cmd, { expiresIn: PRESIGN_EXPIRES }).then(
				(url) => ({
					partNumber,
					url,
					expiresAt: new Date(Date.now() + PRESIGN_EXPIRES * 1000).toISOString(),
				}),
			);
		}),
	);

	return Response.json({
		fileId: file.id,
		uploadId: session.id,
		presignedUrls: urls,
	});
}
