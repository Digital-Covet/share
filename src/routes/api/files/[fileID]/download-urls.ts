import { Effect, Schema } from "effect";
import type { Prisma } from "@generated/project/client";
import { Database } from "@/server/effect/database";
import { DownloadSessions } from "@/server/effect/download-sessions";
import { BadRequest, Forbidden, Gone, NotFound } from "@/server/effect/errors";
import { verifyPasswordEffect } from "@/server/effect/passwords";
import { decodeJsonBody, effectRoute } from "@/server/effect/route";
import { FlagDefaultingToFalse } from "@/server/effect/schemas";
import { Storage } from "@/server/effect/storage";
import { r2FileKey } from "@/server/r2-keys";

const GCM_TAG_BYTES = 16;
// Lets chunk requests already in flight finish before the file becomes unreachable.
const DELETION_GRACE_MS = 5 * 60 * 1000;

const BodySchema = Schema.Struct({
  chunkIndices: Schema.Array(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1000),
  ),
  preview: FlagDefaultingToFalse,
  sessionId: Schema.optionalKey(Schema.String),
});

const downloadSelect = {
  id: true,
  userId: true,
  totalChunks: true,
  chunkSize: true,
  encryptedSize: true,
  originalSize: true,
  status: true,
  expiresAt: true,
  shareLinks: {
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      downloadCount: true,
      isOneTime: true,
      maxDownloads: true,
      consumedAt: true,
      isPasswordProtected: true,
      passwordHash: true,
    },
  },
} satisfies Prisma.FileSelect;

type DownloadableFile = Prisma.FileGetPayload<{ select: typeof downloadSelect }> & {
  userId: string;
};
type ActiveLink = DownloadableFile["shareLinks"][number];

const consumedError = () => new Gone({ message: "File has already been consumed" });
const limitReachedError = () => new Gone({ message: "Download limit reached" });

/**
 * Moves expiry up instead of deleting inline: the purge cron removes the R2
 * objects, and this works on serverless where a post-response timer never fires.
 */
const deferDeletion = Effect.fnUntraced(function* (fileId: string) {
  const db = yield* Database;
  const deadline = new Date(Date.now() + DELETION_GRACE_MS);
  yield* db.use("file.deferDeletion", (prisma) =>
    prisma.file.updateMany({
      where: { id: fileId, OR: [{ expiresAt: null }, { expiresAt: { gt: deadline } }] },
      data: { expiresAt: deadline },
    }),
  );
});

const loadDownloadable = Effect.fnUntraced(function* (fileId: string) {
  const db = yield* Database;
  const file = yield* db.use("file.findForDownload", (prisma) =>
    prisma.file.findUnique({ where: { id: fileId }, select: downloadSelect }),
  );

  if (!file?.userId) return yield* new NotFound({ message: "File not found" });
  if (file.expiresAt && file.expiresAt <= new Date()) {
    return yield* new Gone({ message: "File has expired" });
  }
  if (file.status !== "READY") return yield* new NotFound({ message: "File is not available" });

  const link = file.shareLinks[0];
  if (!link) return yield* new NotFound({ message: "No active share link" });

  return { file: file as DownloadableFile, link };
});

const checkLinkAvailable = Effect.fnUntraced(function* (options: {
  link: ActiveLink;
  fileId: string;
}) {
  const { link, fileId } = options;
  if (link.consumedAt) return yield* consumedError();
  if (link.maxDownloads !== null && link.downloadCount >= link.maxDownloads) {
    yield* deferDeletion(fileId);
    return yield* limitReachedError();
  }
});

const checkPassword = Effect.fnUntraced(function* (options: {
  link: ActiveLink;
  request: Request;
}) {
  const { link, request } = options;
  if (!link.isPasswordProtected) return;

  const passwordRequired = (message: string) =>
    new Forbidden({ message, details: { is_password_protected: true } });

  const password = request.headers.get("x-share-password");
  if (!password) return yield* passwordRequired("Password required");

  const valid = yield* verifyPasswordEffect({ password, stored: link.passwordHash ?? "" });
  if (!valid) return yield* passwordRequired("Invalid password");
});

const claimOneTimeDownload = Effect.fnUntraced(function* (options: {
  link: ActiveLink;
  fileId: string;
}) {
  const db = yield* Database;
  const updated = yield* db.use("shareLink.consumeOneTime", (prisma) =>
    prisma.$executeRaw`
      UPDATE share_links
      SET "consumedAt" = NOW(), "downloadCount" = "downloadCount" + 1
      WHERE id = ${options.link.id} AND "consumedAt" IS NULL
    `,
  );
  if (updated === 0) return yield* consumedError();
  yield* deferDeletion(options.fileId);
});

const claimLimitedDownload = Effect.fnUntraced(function* (options: {
  link: ActiveLink;
  maxDownloads: number;
  fileId: string;
}) {
  const db = yield* Database;
  const { link, maxDownloads, fileId } = options;

  const updated = yield* db.use("shareLink.countLimited", (prisma) =>
    prisma.$executeRaw`
      UPDATE share_links
      SET "downloadCount" = "downloadCount" + 1
      WHERE id = ${link.id} AND "downloadCount" < ${maxDownloads}
    `,
  );
  if (updated === 0) {
    yield* deferDeletion(fileId);
    return yield* limitReachedError();
  }

  const refreshed = yield* db.use("shareLink.recount", (prisma) =>
    prisma.shareLink.findUnique({
      where: { id: link.id },
      select: { downloadCount: true, maxDownloads: true },
    }),
  );
  if (refreshed?.maxDownloads != null && refreshed.downloadCount >= refreshed.maxDownloads) {
    yield* deferDeletion(fileId);
  }
});

const recordDownload = Effect.fnUntraced(function* (options: {
  link: ActiveLink;
  fileId: string;
}) {
  const { link, fileId } = options;
  if (link.isOneTime) return yield* claimOneTimeDownload({ link, fileId });
  if (link.maxDownloads !== null) {
    return yield* claimLimitedDownload({ link, maxDownloads: link.maxDownloads, fileId });
  }
  yield* (yield* Database).use("shareLink.count", (prisma) =>
    prisma.shareLink.update({
      where: { id: link.id },
      data: { downloadCount: { increment: 1 } },
    }),
  );
});

const byteRangeOf = (file: DownloadableFile, index: number): string => {
  const stride = file.chunkSize + GCM_TAG_BYTES;
  const start = index * stride;
  const end =
    index === file.totalChunks - 1
      ? Number(file.encryptedSize ?? file.originalSize) - 1
      : start + stride - 1;
  return `bytes=${start}-${end}`;
};

const presignChunks = Effect.fnUntraced(function* (options: {
  file: DownloadableFile;
  chunkIndices: ReadonlyArray<number>;
}) {
  const storage = yield* Storage;
  const { file, chunkIndices } = options;
  const key = r2FileKey(file.userId, file.id);

  return yield* Effect.forEach(
    chunkIndices,
    (index) => {
      const range = byteRangeOf(file, index);
      return storage
        .presignRange({ key, range })
        .pipe(Effect.map((url) => ({ index, url, range })));
    },
    { concurrency: "unbounded" },
  );
});

export const POST = effectRoute(
  ({ request, params }: { request: Request; params: { fileID: string } }) =>
    Effect.gen(function* () {
      const { chunkIndices, preview, sessionId } = yield* decodeJsonBody(request, BodySchema);
      const sessions = yield* DownloadSessions;
      const { file, link } = yield* loadDownloadable(params.fileID);

      const hasValidSession =
        !preview && sessionId !== undefined && sessions.verify(sessionId, link.id);
      const needsAuthorization = !hasValidSession;

      if (needsAuthorization) {
        yield* checkLinkAvailable({ link, fileId: file.id });
        yield* checkPassword({ link, request });
      }

      const outOfRange = chunkIndices.find((index) => index >= file.totalChunks);
      if (outOfRange !== undefined) {
        return yield* new BadRequest({
          message: `Chunk index ${outOfRange} exceeds total chunks (${file.totalChunks})`,
        });
      }

      if (!preview && needsAuthorization) {
        yield* recordDownload({ link, fileId: file.id });
      }

      const urls = yield* presignChunks({ file, chunkIndices });

      if (preview) return Response.json({ urls });
      return Response.json({
        urls,
        sessionId: hasValidSession ? sessionId : sessions.create(link.id),
      });
    }),
);
