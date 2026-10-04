import { Effect, Schema } from "effect";
import { Auth } from "@/server/effect/auth";
import { Database } from "@/server/effect/database";
import { decodeJsonBody, effectRoute } from "@/server/effect/route";
import { PositiveInt } from "@/server/effect/schemas";
import { Storage } from "@/server/effect/storage";
import { r2FileKey } from "@/server/r2-keys";

const MULTIPART_BATCH = 5;
const MAX_FILE_SIZE = Math.floor(9.9 * 1024 * 1024 * 1024);
const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const BodySchema = Schema.Struct({
  file_name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(1024)),
  mime_type: Schema.NonEmptyString,
  original_size: PositiveInt.check(
    Schema.isLessThanOrEqualTo(MAX_FILE_SIZE, { message: "File size must not exceed 9.9 GB" }),
  ),
  total_chunks: PositiveInt,
  iv_base_hash: Schema.NonEmptyString,
  encryption_key: Schema.NonEmptyString,
  iv_base: Schema.NonEmptyString,
});

type UploadRequest = typeof BodySchema.Type;

const registerUpload = Effect.fnUntraced(function* (options: {
  userId: string;
  fileId: string;
  r2Key: string;
  uploadId: string;
  upload: UploadRequest;
}) {
  const db = yield* Database;
  const { userId, fileId, r2Key, uploadId, upload } = options;

  return yield* db.use("upload.register", (prisma) =>
    prisma.$transaction([
      prisma.file.create({
        data: {
          id: fileId,
          userId,
          fileName: upload.file_name,
          mimeType: upload.mime_type,
          originalSize: BigInt(upload.original_size),
          totalChunks: upload.total_chunks,
          ivBaseHash: upload.iv_base_hash,
          ivBase: upload.iv_base,
          encryptionKey: upload.encryption_key,
          r2Key,
          status: "PENDING",
        },
      }),
      prisma.uploadSession.create({
        data: {
          fileId,
          multipartUploadId: uploadId,
          status: "INITIATED",
          totalParts: upload.total_chunks,
          expiresAt: new Date(Date.now() + UPLOAD_SESSION_TTL_MS),
        },
      }),
    ]),
  );
});

export const POST = effectRoute(({ request }: { request: Request }) =>
  Effect.gen(function* () {
    const user = yield* (yield* Auth).requireUser(request);
    const upload = yield* decodeJsonBody(request, BodySchema);
    const storage = yield* Storage;

    const fileId = crypto.randomUUID();
    const r2Key = r2FileKey(user.id, fileId);
    const uploadId = yield* storage.createMultipartUpload({
      key: r2Key,
      contentType: upload.mime_type,
    });

    // Without this the multipart upload would linger in R2 until the purge cron aborts it.
    const [file, session] = yield* registerUpload({
      userId: user.id,
      fileId,
      r2Key,
      uploadId,
      upload,
    }).pipe(
      Effect.tapError(() =>
        storage.abortMultipartUpload({ key: r2Key, uploadId }).pipe(Effect.ignore),
      ),
    );

    const partCount = Math.min(MULTIPART_BATCH, upload.total_chunks);
    const presignedUrls = yield* storage.presignUploadParts({
      key: r2Key,
      uploadId,
      partNumbers: Array.from({ length: partCount }, (_, i) => i + 1),
    });

    return Response.json({ fileId: file.id, uploadId: session.id, presignedUrls });
  }),
);
