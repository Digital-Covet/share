import { Effect, Schema } from "effect";
import { Auth } from "@/server/effect/auth";
import { Database } from "@/server/effect/database";
import { Conflict } from "@/server/effect/errors";
import { requireOwnedFile } from "@/server/effect/files";
import { hashPasswordEffect } from "@/server/effect/passwords";
import { decodeJsonBody, effectRoute } from "@/server/effect/route";
import {
  FlagDefaultingToFalse,
  isPasswordRequirementMet,
  PasswordField,
  PositiveInt,
} from "@/server/effect/schemas";
import { Storage } from "@/server/effect/storage";
import { calculateExpiry, SecuritySettingsSchema } from "./_shared";

const BodySchema = Schema.Struct({
  fileId: Schema.NonEmptyString,
  encrypted_size: PositiveInt,
  etags: Schema.Array(
    Schema.Struct({ partNumber: PositiveInt, etag: Schema.NonEmptyString }),
  ).check(Schema.isMinLength(1)),
  security_settings: SecuritySettingsSchema,
  is_password_protected: FlagDefaultingToFalse,
  password: PasswordField,
}).check(
  Schema.makeFilter(
    (body) => isPasswordRequirementMet(body) || "Password required when protection is enabled",
  ),
);

export const POST = effectRoute(({ request }: { request: Request }) =>
  Effect.gen(function* () {
    const user = yield* (yield* Auth).requireUser(request);
    const body = yield* decodeJsonBody(request, BodySchema);
    const db = yield* Database;
    const storage = yield* Storage;

    const found = yield* db.use("file.findForCompletion", (prisma) =>
      prisma.file.findUnique({
        where: { id: body.fileId },
        include: { uploadSessions: { where: { status: { not: "COMPLETED" } } } },
      }),
    );
    const file = yield* requireOwnedFile(found, user.id);

    if (file.status !== "PENDING") {
      return yield* new Conflict({ message: "File is not in pending state" });
    }

    const session = file.uploadSessions[0];
    if (!session?.multipartUploadId) {
      return yield* new Conflict({ message: "No active upload session" });
    }

    yield* storage.completeMultipartUpload({
      key: file.r2Key,
      uploadId: session.multipartUploadId,
      parts: [...body.etags].sort((a, b) => a.partNumber - b.partNumber),
    });

    const linkExpiresAt = calculateExpiry(body.security_settings);
    const passwordHash =
      body.is_password_protected && body.password
        ? yield* hashPasswordEffect(body.password)
        : null;

    const [updatedFile, shareLink] = yield* db.use("upload.complete", (prisma) =>
      prisma.$transaction([
        prisma.file.update({
          where: { id: body.fileId },
          data: {
            status: "READY",
            encryptedSize: BigInt(body.encrypted_size),
            expiresAt: linkExpiresAt,
          },
        }),
        prisma.uploadSession.update({
          where: { id: session.id },
          data: {
            status: "COMPLETED",
            completedPartEtags: JSON.stringify(body.etags),
            completedAt: new Date(),
          },
        }),
        prisma.shareLink.create({
          data: {
            fileId: body.fileId,
            expiresAt: linkExpiresAt,
            isOneTime: body.security_settings.oneTimeDownload,
            maxDownloads: body.security_settings.maxDownloads,
            isPasswordProtected: passwordHash !== null,
            passwordHash,
          },
        }),
      ]),
    );

    return Response.json({
      fileId: updatedFile.id,
      status: updatedFile.status,
      encryptedSize: updatedFile.encryptedSize?.toString() ?? null,
      shareLink: {
        id: shareLink.id,
        expiresAt: shareLink.expiresAt?.toISOString() ?? null,
      },
    });
  }),
);
