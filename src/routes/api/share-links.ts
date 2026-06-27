import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { hashPassword } from "@/lib/crypto/password";

const BodySchema = z.object({
	fileId: z.string().min(1),
	is_one_time: z.boolean().default(false),
	max_downloads: z.number().int().min(1).max(100).nullable().default(null),
	expires_in_days: z.number().int().min(1).max(365).default(7),
	is_password_protected: z.boolean().default(false),
	password: z.string().min(1).max(128).nullable().default(null),
});

export async function POST({ request }: { request: Request }) {
	const user = await requireUser(request);

	const raw = await request.json();
	const parsed = BodySchema.safeParse(raw);
	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid payload", issues: z.treeifyError(parsed.error) },
			{ status: 422 },
		);
	}

	const {
		fileId,
		is_one_time,
		max_downloads,
		expires_in_days,
		is_password_protected,
		password,
	} = parsed.data;

	const file = await prisma.file.findUnique({
		where: { id: fileId },
		select: {
			id: true,
			userId: true,
			status: true,
			expiresAt: true,
		},
	});

	if (!file || file.userId !== user.id) {
		return Response.json({ error: "File not found" }, { status: 404 });
	}

	if (file.status !== "READY") {
		return Response.json({ error: "File is not available" }, { status: 409 });
	}

	const now = new Date();
	if (file.expiresAt && file.expiresAt <= now) {
		return Response.json({ error: "File has expired" }, { status: 410 });
	}

	if (is_one_time) {
		const existingOneTime = await prisma.shareLink.findFirst({
			where: {
				fileId,
				status: "ACTIVE",
				isOneTime: true,
				consumedAt: null,
			},
			select: { id: true },
		});

		if (existingOneTime) {
			return Response.json(
				{ error: "An active one-time share link already exists for this file" },
				{ status: 409 },
			);
		}
	}

	let passwordHash: string | null = null;
	if (is_password_protected && password) {
		passwordHash = await hashPassword(password);
	}

	const linkExpiresAt = new Date(
		now.getTime() + expires_in_days * 24 * 60 * 60 * 1000,
	);

	const needsFileUpdate =
		file.expiresAt === null || linkExpiresAt < file.expiresAt;

	const results = await prisma.$transaction([
		prisma.shareLink.create({
			data: {
				fileId,
				expiresAt: linkExpiresAt,
				isOneTime: is_one_time,
				maxDownloads: max_downloads,
				isPasswordProtected: is_password_protected,
				passwordHash,
			},
			select: {
				id: true,
				expiresAt: true,
			},
		}),
		...(needsFileUpdate
			? [
					prisma.file.update({
						where: { id: fileId },
						data: { expiresAt: linkExpiresAt },
					}),
				]
			: []),
	]);

	const shareLink = results[0];

	return Response.json({
		shareLinkId: shareLink.id,
		expiresAt: shareLink.expiresAt?.toISOString() ?? null,
	});
}
