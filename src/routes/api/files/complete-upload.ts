import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { r2 } from "@/server/r2";
import { calculateExpiry, SecuritySettingsSchema } from "./_shared";

const BUCKET = process.env.R2_BUCKET!;

const BodySchema = z.object({
  fileId: z.string().min(1),
  encrypted_size: z.number().int().positive(),
  etags: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        etag: z.string().min(1),
      }),
    )
    .min(1),
  security_settings: SecuritySettingsSchema,
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

  const { fileId, encrypted_size, etags, security_settings } = parsed.data;

  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { uploadSessions: { where: { status: { not: "COMPLETED" } } } },
  });

  if (!file || file.userId !== user.id) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  if (file.status !== "PENDING") {
    return Response.json(
      { error: "File is not in pending state" },
      { status: 409 },
    );
  }

  const session = file.uploadSessions[0];
  if (!session?.multipartUploadId) {
    return Response.json(
      { error: "No active upload session" },
      { status: 409 },
    );
  }

  const sortedParts = [...etags].sort((a, b) => a.partNumber - b.partNumber);

  const completeCmd = new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: file.r2Key,
    UploadId: session.multipartUploadId,
    MultipartUpload: {
      Parts: sortedParts.map((e) => ({
        PartNumber: e.partNumber,
        ETag: e.etag,
      })),
    },
  });

  await r2.send(completeCmd);

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
    prisma.uploadSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        completedPartEtags: JSON.stringify(etags),
        completedAt: new Date(),
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
