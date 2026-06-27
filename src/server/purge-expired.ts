import {
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { prisma } from "@/db/project";
import { UPLOAD_SESSION_INACTIVITY_HOURS } from "@/lib/constants";
import { r2 } from "./r2";
import { r2FileKey, r2PartKey } from "./r2-keys";

const BUCKET = process.env.R2_BUCKET!;
const BATCH_SIZE = 100;

export async function purgeExpiredFiles(): Promise<{
  filesDeleted: number;
  sessionsAborted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let filesDeleted = 0;
  let sessionsAborted = 0;

  const now = new Date();

  // 1. READY files past their expiresAt → delete R2 chunks, mark DELETED
  const expiredReady = await prisma.file.findMany({
    where: {
      status: "READY",
      expiresAt: { not: null, lt: now },
    },
    take: BATCH_SIZE,
    select: { id: true, userId: true, totalChunks: true },
  });

  for (const file of expiredReady) {
    try {
      if (file.userId) {
        if (file.totalChunks === 1) {
          await r2.send(
            new DeleteObjectCommand({
              Bucket: BUCKET,
              Key: r2FileKey(file.userId, file.id),
            }),
          );
        } else {
          for (let i = 1; i <= file.totalChunks; i++) {
            await r2.send(
              new DeleteObjectCommand({
                Bucket: BUCKET,
                Key: r2PartKey(file.userId, file.id, i),
              }),
            );
          }
        }
      }
      await prisma.file.update({
        where: { id: file.id },
        data: { status: "DELETED" },
      });
      filesDeleted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`delete READY ${file.id}: ${msg}`);
    }
  }

  // 2. REVOKED files → delete R2 chunks, mark DELETED (Zero-Trust: R2 objects left intact by /delete endpoint)
  const revokedFiles = await prisma.file.findMany({
    where: {
      status: "REVOKED",
    },
    take: BATCH_SIZE,
    select: { id: true, userId: true, totalChunks: true },
  });

  for (const file of revokedFiles) {
    try {
      if (file.userId) {
        if (file.totalChunks === 1) {
          await r2.send(
            new DeleteObjectCommand({
              Bucket: BUCKET,
              Key: r2FileKey(file.userId, file.id),
            }),
          );
        } else {
          for (let i = 1; i <= file.totalChunks; i++) {
            await r2.send(
              new DeleteObjectCommand({
                Bucket: BUCKET,
                Key: r2PartKey(file.userId, file.id, i),
              }),
            );
          }
        }
      }
      await prisma.file.update({
        where: { id: file.id },
        data: { status: "DELETED" },
      });
      filesDeleted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`delete REVOKED ${file.id}: ${msg}`);
    }
  }

  // 3. PENDING upload sessions older than INACTIVITY_HOURS → abort multipart
  const staleThreshold = new Date(
    now.getTime() - UPLOAD_SESSION_INACTIVITY_HOURS * 60 * 60 * 1000,
  );

  const staleSessions = await prisma.uploadSession.findMany({
    where: {
      status: { in: ["INITIATED", "UPLOADING"] },
      multipartUploadId: { not: null },
      createdAt: { lt: staleThreshold },
    },
    take: BATCH_SIZE,
    select: {
      id: true,
      fileId: true,
      multipartUploadId: true,
      file: { select: { r2Key: true } },
    },
  });

  for (const session of staleSessions) {
    try {
      await r2.send(
        new AbortMultipartUploadCommand({
          Bucket: BUCKET,
          Key: session.file.r2Key,
          UploadId: session.multipartUploadId!,
        }),
      );
      await prisma.$transaction([
        prisma.uploadSession.update({
          where: { id: session.id },
          data: { status: "ABORTED" },
        }),
        prisma.file.update({
          where: { id: session.fileId },
          data: { status: "FAILED" },
        }),
      ]);
      sessionsAborted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`abort session ${session.id}: ${msg}`);
    }
  }

  return { filesDeleted, sessionsAborted, errors };
}
