import { UploadPartCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { PRESIGN_EXPIRES } from "@/lib/constants";
import { requireUser } from "@/lib/auth.server";
import { getSignedUrl, r2 } from "@/server/r2";

const QuerySchema = z.object({
  fileId: z.string().min(1),
  parts: z.array(z.number().int().positive()).min(1),
});

export async function GET({ request, url }: { request: Request; url: URL }) {
  const user = await requireUser(request);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success)
    return Response.json({ error: "Invalid params" }, { status: 422 });

  const { fileId, parts } = parsed.data;
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { uploadSessions: { where: { status: "INITIATED" } } },
  });

  if (!file || file.userId !== user.id || !file.uploadSessions[0]) {
    return Response.json({ error: "No active upload" }, { status: 404 });
  }

  const session = file.uploadSessions[0];
  const urls = await Promise.all(
    parts.map(async (partNumber) => {
      const cmd = new UploadPartCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: file.r2Key,
        PartNumber: partNumber,
        UploadId: session.multipartUploadId!,
      });
      const link = await getSignedUrl(r2, cmd, { expiresIn: PRESIGN_EXPIRES });
      return {
        partNumber,
        url: link,
        expiresAt: new Date(Date.now() + PRESIGN_EXPIRES * 1000).toISOString(),
      };
    }),
  );

  return Response.json({ fileId, presignedUrls: urls });
}
