import { Effect, Schema } from "effect";
import { Auth } from "@/server/effect/auth";
import { Database } from "@/server/effect/database";
import { Gone } from "@/server/effect/errors";
import { requireOwnedFile } from "@/server/effect/files";
import { decodeJsonBody, effectRoute } from "@/server/effect/route";
import { FlagDefaultingToFalse, PositiveInt } from "@/server/effect/schemas";

const BodySchema = Schema.Struct({
  expiresAt: PositiveInt,
  isOneTime: FlagDefaultingToFalse,
});

const IMMUTABLE_MESSAGES = {
  DELETED: "This file has been permanently deleted and cannot be modified.",
  REVOKED: "This file has been revoked per Zero-Trust policy and cannot be modified.",
} as const;

const shareLinkUpdateFor = (options: { expiresAt: Date; isOneTime: boolean }) =>
  options.isOneTime
    ? {
        expiresAt: options.expiresAt,
        isOneTime: true,
        consumedAt: null,
        downloadCount: 0,
        maxDownloads: 1,
      }
    : { expiresAt: options.expiresAt, isOneTime: false, maxDownloads: null };

export const POST = effectRoute(
  ({ request, params }: { request: Request; params: { fileID: string } }) =>
    Effect.gen(function* () {
      const user = yield* (yield* Auth).requireUser(request);
      const { expiresAt, isOneTime } = yield* decodeJsonBody(request, BodySchema);
      const db = yield* Database;

      const found = yield* db.use("file.findForExpiry", (prisma) =>
        prisma.file.findUnique({
          where: { id: params.fileID },
          select: { id: true, userId: true, status: true },
        }),
      );
      const file = yield* requireOwnedFile(found, user.id);

      if (file.status === "DELETED" || file.status === "REVOKED") {
        return yield* new Gone({ message: IMMUTABLE_MESSAGES[file.status] });
      }

      const newExpiresAt = new Date(expiresAt);

      yield* db.use("file.updateExpiry", (prisma) =>
        prisma.$transaction([
          prisma.file.update({ where: { id: file.id }, data: { expiresAt: newExpiresAt } }),
          prisma.shareLink.updateMany({
            where: { fileId: file.id, status: "ACTIVE" },
            data: shareLinkUpdateFor({ expiresAt: newExpiresAt, isOneTime }),
          }),
        ]),
      );

      return Response.json({ ok: true, expiresAt: newExpiresAt.toISOString() });
    }),
);
