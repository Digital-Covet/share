import { Effect } from "effect";
import { Auth } from "@/server/effect/auth";
import { Database } from "@/server/effect/database";
import { Gone } from "@/server/effect/errors";
import { requireOwnedFile } from "@/server/effect/files";
import { effectRoute } from "@/server/effect/route";
import { Storage } from "@/server/effect/storage";

export const POST = effectRoute(
  ({ request, params }: { request: Request; params: { fileID: string } }) =>
    Effect.gen(function* () {
      const user = yield* (yield* Auth).requireUser(request);
      const db = yield* Database;

      const found = yield* db.use("file.findForDelete", (prisma) =>
        prisma.file.findUnique({
          where: { id: params.fileID },
          select: { id: true, userId: true, status: true, totalChunks: true },
        }),
      );
      const file = yield* requireOwnedFile(found, user.id);

      if (file.status === "DELETED" || file.status === "REVOKED") {
        return yield* new Gone({ message: "File already deleted" });
      }

      const failures = yield* (yield* Storage).deleteFileObjects({
        userId: user.id,
        fileId: file.id,
        totalChunks: file.totalChunks,
      });
      if (failures.length > 0) {
        yield* Effect.logError(
          `Delete file: failed to delete ${failures.length} R2 objects for file ${file.id}`,
          failures,
        );
      }

      yield* db.use("file.markDeleted", (prisma) =>
        prisma.$transaction([
          prisma.shareLink.updateMany({
            where: { fileId: file.id, status: "ACTIVE" },
            data: { status: "REVOKED", revokedAt: new Date() },
          }),
          prisma.file.update({ where: { id: file.id }, data: { status: "DELETED" } }),
        ]),
      );

      return Response.json({ ok: true });
    }),
);
