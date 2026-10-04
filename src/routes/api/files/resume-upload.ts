import { Effect, Schema } from "effect";
import { Auth } from "@/server/effect/auth";
import { Database } from "@/server/effect/database";
import { NotFound } from "@/server/effect/errors";
import { decodeInput, effectRoute } from "@/server/effect/route";
import { PositiveInt } from "@/server/effect/schemas";
import { Storage } from "@/server/effect/storage";

const QuerySchema = Schema.Struct({
  fileId: Schema.NonEmptyString,
  parts: Schema.Array(PositiveInt).check(Schema.isMinLength(1)),
});

export const GET = effectRoute(({ request, url }: { request: Request; url: URL }) =>
  Effect.gen(function* () {
    const user = yield* (yield* Auth).requireUser(request);
    const { fileId, parts } = yield* decodeInput(QuerySchema, {
      fileId: url.searchParams.get("fileId"),
      parts: url.searchParams.getAll("parts").map(Number),
    });
    const db = yield* Database;

    const file = yield* db.use("file.findForResume", (prisma) =>
      prisma.file.findUnique({
        where: { id: fileId },
        include: { uploadSessions: { where: { status: "INITIATED" } } },
      }),
    );
    const uploadId = file?.uploadSessions[0]?.multipartUploadId;
    if (!file || file.userId !== user.id || !uploadId) {
      return yield* new NotFound({ message: "No active upload" });
    }

    const presignedUrls = yield* (yield* Storage).presignUploadParts({
      key: file.r2Key,
      uploadId,
      partNumbers: parts,
    });

    return Response.json({ fileId, presignedUrls });
  }),
);
