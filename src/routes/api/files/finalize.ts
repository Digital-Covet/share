import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { SecuritySettingsSchema, calculateExpiry } from "./_shared";

const BodySchema = z.object({
	fileId: z.string().min(1),
	encrypted_size: z.number().int().positive(),
	security_settings: SecuritySettingsSchema,
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

	const { fileId, encrypted_size, security_settings } = parsed.data;

	const file = await prisma.file.findUnique({
		where: { id: fileId },
		select: { id: true, userId: true, status: true },
	});

	if (!file || file.userId !== user.id) {
		return Response.json({ error: "File not found" }, { status: 404 });
	}

	if (file.status !== "PENDING") {
		return Response.json({ error: "File is not in pending state" }, { status: 409 });
	}

	const hasSession = await prisma.uploadSession.findUnique({
		where: { fileId },
		select: { id: true },
	});

	if (hasSession) {
		return Response.json(
			{ error: "Use /complete-upload for multipart uploads" },
			{ status: 409 },
		);
	}

	const linkExpiresAt = calculateExpiry(security_settings);

	const [updatedFile, shareLink] = await prisma.$transaction([
		prisma.file.update({
			where: { id: fileId },
			data: {
				status: "READY",
				encryptedSize: BigInt(encrypted_size),
				expiresAt: linkExpiresAt,
			},
		}),
		prisma.shareLink.create({
			data: {
				fileId,
				expiresAt: linkExpiresAt,
				isOneTime: security_settings.oneTimeDownload,
				maxDownloads: security_settings.maxDownloads,
			},
		}),
	]);

	return Response.json({
		fileId: updatedFile.id,
		status: updatedFile.status,
		encryptedSize: updatedFile.encryptedSize?.toString() ?? null,
		shareLink: {
			id: shareLink.id,
			expiresAt: shareLink.expiresAt?.toISOString() ?? null,
		},
	});
}
