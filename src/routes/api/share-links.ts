import { Effect, Schema } from "effect";
import { Auth } from "@/server/effect/auth";
import { Database } from "@/server/effect/database";
import { Conflict, Gone } from "@/server/effect/errors";
import { requireOwnedFile } from "@/server/effect/files";
import { hashPasswordEffect } from "@/server/effect/passwords";
import { decodeJsonBody, effectRoute } from "@/server/effect/route";
import {
  FlagDefaultingToFalse,
  intBetween,
  MaxDownloadsField,
  PasswordField,
} from "@/server/effect/schemas";

const DAY_MS = 24 * 60 * 60 * 1000;

const BodySchema = Schema.Struct({
  fileId: Schema.NonEmptyString,
  is_one_time: FlagDefaultingToFalse,
  max_downloads: MaxDownloadsField,
  expires_in_days: intBetween(1, 365).pipe(Schema.withDecodingDefault(Effect.succeed(7))),
  is_password_protected: FlagDefaultingToFalse,
  password: PasswordField,
});

export const POST = effectRoute(({ request }: { request: Request }) =>
  Effect.gen(function* () {
    const user = yield* (yield* Auth).requireUser(request);
    const body = yield* decodeJsonBody(request, BodySchema);
    const db = yield* Database;
    const { fileId } = body;

    const found = yield* db.use("file.findForShareLink", (prisma) =>
      prisma.file.findUnique({
        where: { id: fileId },
        select: { id: true, userId: true, status: true, expiresAt: true },
      }),
    );
    const file = yield* requireOwnedFile(found, user.id);

    if (file.status !== "READY") return yield* new Conflict({ message: "File is not available" });

    const now = new Date();
    if (file.expiresAt && file.expiresAt <= now) {
      return yield* new Gone({ message: "File has expired" });
    }

    if (body.is_one_time) {
      const existingOneTime = yield* db.use("shareLink.findActiveOneTime", (prisma) =>
        prisma.shareLink.findFirst({
          where: { fileId, status: "ACTIVE", isOneTime: true, consumedAt: null },
          select: { id: true },
        }),
      );
      if (existingOneTime) {
        return yield* new Conflict({
          message: "An active one-time share link already exists for this file",
        });
      }
    }

    const passwordHash =
      body.is_password_protected && body.password
        ? yield* hashPasswordEffect(body.password)
        : null;

    const linkExpiresAt = new Date(now.getTime() + body.expires_in_days * DAY_MS);
    const needsFileUpdate = file.expiresAt === null || linkExpiresAt < file.expiresAt;

    const [shareLink] = yield* db.use("shareLink.create", (prisma) =>
      prisma.$transaction([
        prisma.shareLink.create({
          data: {
            fileId,
            expiresAt: linkExpiresAt,
            isOneTime: body.is_one_time,
            maxDownloads: body.max_downloads,
            isPasswordProtected: body.is_password_protected,
            passwordHash,
          },
          select: { id: true, expiresAt: true },
        }),
        ...(needsFileUpdate
          ? [prisma.file.update({ where: { id: fileId }, data: { expiresAt: linkExpiresAt } })]
          : []),
      ]),
    );

    return Response.json({
      shareLinkId: shareLink.id,
      expiresAt: shareLink.expiresAt?.toISOString() ?? null,
    });
  }),
);
