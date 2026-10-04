import { Effect, Schema } from "effect";
import { Auth } from "@/server/effect/auth";
import { Database } from "@/server/effect/database";
import { Conflict } from "@/server/effect/errors";
import { requireOwnedFile } from "@/server/effect/files";
import { decodeJsonBody, effectRoute } from "@/server/effect/route";
import { PositiveInt } from "@/server/effect/schemas";
import { calculateExpiry, SecuritySettingsSchema } from "./_shared";

const BodySchema = Schema.Struct({
  fileId: Schema.NonEmptyString,
  encrypted_size: PositiveInt,
  security_settings: SecuritySettingsSchema,
});

export const POST = effectRoute(({ request }: { request: Request }) =>
  Effect.gen(function* () {
    const user = yield* (yield* Auth).requireUser(request);
    const { fileId, encrypted_size, security_settings } = yield* decodeJsonBody(
      request,
      BodySchema,
    );
    const db = yield* Database;

    const found = yield* db.use("file.findForFinalize", (prisma) =>
      prisma.file.findUnique({
        where: { id: fileId },
        select: { id: true, userId: true, status: true },
      }),
    );
    const file = yield* requireOwnedFile(found, user.id);

    if (file.status !== "PENDING") {
      return yield* new Conflict({ message: "File is not in pending state" });
    }

    const multipartSession = yield* db.use("uploadSession.find", (prisma) =>
      prisma.uploadSession.findUnique({ where: { fileId }, select: { id: true } }),
    );
    if (multipartSession) {
      return yield* new Conflict({ message: "Use /complete-upload for multipart uploads" });
    }

    const linkExpiresAt = calculateExpiry(security_settings);

    const [updatedFile, shareLink] = yield* db.use("upload.finalize", (prisma) =>
      prisma.$transaction([
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
