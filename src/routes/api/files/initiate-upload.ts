import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { getSignedUrl, r2 } from "@/server/r2";
import { r2FileKey } from "@/server/r2-keys";
import { PRESIGN_EXPIRES } from "@/lib/constants";

const BUCKET = process.env.R2_BUCKET!;
const MULTIPART_BATCH = 5;
const MAX_FILE_SIZE = Math.floor(9.9 * 1024 * 1024 * 1024);

const BodySchema = z.object({
  file_name: z.string().min(1).max(1024),
  mime_type: z.string().min(1),
  original_size: z.number().int().positive().max(MAX_FILE_SIZE, `File size must not exceed 9.9 GB`),
  total_chunks: z.number().int().positive(),
  iv_base_hash: z.string().min(1),
  encryption_key: z.string().min(1),
  iv_base: z.string().min(1),
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

  const { file_name, mime_type, original_size, total_chunks, iv_base_hash, encryption_key, iv_base } =
    parsed.data;

  const fileId = crypto.randomUUID();
  const r2Key = r2FileKey(user.id, fileId);

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
      ivBase: iv_base,
      encryptionKey: encryption_key,
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
          expiresAt: new Date(
            Date.now() + PRESIGN_EXPIRES * 1000,
          ).toISOString(),
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
