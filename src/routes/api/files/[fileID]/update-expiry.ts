import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";

const BodySchema = z.object({
	expiresAt: z.number().int().positive(),
});

export async function POST({
	request,
	params,
}: {
	request: Request;
	params: { fileID: string };
}) {
	const user = await requireUser(request);
	const { fileID } = params;

	const raw = await request.json();
	const parsed = BodySchema.safeParse(raw);
	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid payload", issues: z.treeifyError(parsed.error) },
			{ status: 422 },
		);
	}

	const { expiresAt } = parsed.data;

	const file = await prisma.file.findUnique({
		where: { id: fileID },
		select: {
			id: true,
			userId: true,
			status: true,
		},
	});

	if (!file || file.userId !== user.id) {
		return Response.json({ error: "File not found" }, { status: 404 });
	}

	if (file.status === "DELETED") {
		return Response.json(
			{ error: "This file has been permanently deleted and cannot be modified." },
			{ status: 410 },
		);
	}

	if (file.status === "REVOKED") {
		return Response.json(
			{ error: "This file has been revoked per Zero-Trust policy and cannot be modified." },
			{ status: 410 },
		);
	}

	const newExpiresAt = new Date(expiresAt);

	await prisma.$transaction([
		prisma.file.update({
			where: { id: file.id },
			data: { expiresAt: newExpiresAt },
		}),
		prisma.shareLink.updateMany({
			where: { fileId: file.id, status: "ACTIVE" },
			data: { expiresAt: newExpiresAt },
		}),
	]);

	return Response.json({
		ok: true,
		expiresAt: newExpiresAt.toISOString(),
	});
}
