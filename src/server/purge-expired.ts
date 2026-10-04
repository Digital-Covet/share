import { Effect } from "effect";
import type { Prisma } from "@generated/project/client";
import { UPLOAD_SESSION_INACTIVITY_HOURS } from "@/lib/constants";
import { Database } from "./effect/database";
import type { DatabaseError, StorageError } from "./effect/errors";
import { Storage } from "./effect/storage";

const BATCH_SIZE = 100;
const CONCURRENCY = 5;

export interface PurgeReport {
  readonly filesDeleted: number;
  readonly sessionsAborted: number;
  readonly errors: ReadonlyArray<string>;
}

interface BatchOutcome {
  readonly succeeded: number;
  readonly errors: ReadonlyArray<string>;
}

const describeError = ({ operation, cause }: DatabaseError | StorageError): string =>
  `${operation}: ${cause instanceof Error ? cause.message : String(cause)}`;

/** One failing item never stops the batch; it is reported and retried on the next run. */
const runBatch = <Item, R>(options: {
  items: ReadonlyArray<Item>;
  label: (item: Item) => string;
  task: (item: Item) => Effect.Effect<void, string, R>;
}): Effect.Effect<BatchOutcome, never, R> =>
  Effect.forEach(
    options.items,
    (item) =>
      options.task(item).pipe(
        Effect.match({
          onSuccess: () => undefined,
          onFailure: (message) => `${options.label(item)}: ${message}`,
        }),
      ),
    { concurrency: CONCURRENCY },
  ).pipe(
    Effect.map((results) => {
      const errors = results.filter((result) => result !== undefined);
      return { succeeded: results.length - errors.length, errors };
    }),
  );

const purgeFilesWhere = Effect.fnUntraced(function* (options: {
  where: Prisma.FileWhereInput;
  label: string;
}) {
  const db = yield* Database;
  const storage = yield* Storage;

  const files = yield* db.use(`purge.find ${options.label}`, (prisma) =>
    prisma.file.findMany({
      where: options.where,
      take: BATCH_SIZE,
      select: { id: true, userId: true, totalChunks: true },
    }),
  );

  return yield* runBatch({
    items: files,
    label: (file) => `delete ${options.label} ${file.id}`,
    task: (file) =>
      Effect.gen(function* () {
        if (file.userId) {
          const failures = yield* storage.deleteFileObjects({
            userId: file.userId,
            fileId: file.id,
            totalChunks: file.totalChunks,
          });
          if (failures.length > 0) return yield* Effect.fail(failures.join("; "));
        }
        yield* db
          .use("purge.markDeleted", (prisma) =>
            prisma.file.update({ where: { id: file.id }, data: { status: "DELETED" } }),
          )
          .pipe(Effect.mapError(describeError));
      }),
  });
});

const abortStaleSessions = Effect.fnUntraced(function* (now: Date) {
  const db = yield* Database;
  const storage = yield* Storage;
  const staleThreshold = new Date(
    now.getTime() - UPLOAD_SESSION_INACTIVITY_HOURS * 60 * 60 * 1000,
  );

  const sessions = yield* db.use("purge.findStaleSessions", (prisma) =>
    prisma.uploadSession.findMany({
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
    }),
  );

  return yield* runBatch({
    items: sessions,
    label: (session) => `abort session ${session.id}`,
    task: (session) =>
      Effect.gen(function* () {
        yield* storage
          .abortMultipartUpload({
            key: session.file.r2Key,
            uploadId: session.multipartUploadId as string,
          })
          .pipe(Effect.mapError(describeError));
        yield* db
          .use("purge.markSessionAborted", (prisma) =>
            prisma.$transaction([
              prisma.uploadSession.update({
                where: { id: session.id },
                data: { status: "ABORTED" },
              }),
              prisma.file.update({ where: { id: session.fileId }, data: { status: "FAILED" } }),
            ]),
          )
          .pipe(Effect.mapError(describeError));
      }),
  });
});

export const purgeExpiredFiles: Effect.Effect<PurgeReport, DatabaseError, Database | Storage> =
  Effect.gen(function* () {
    const now = new Date();

    const expired = yield* purgeFilesWhere({
      where: { status: "READY", expiresAt: { not: null, lt: now } },
      label: "READY",
    });
    // Zero-Trust: the delete endpoint leaves R2 objects intact for REVOKED files.
    const revoked = yield* purgeFilesWhere({ where: { status: "REVOKED" }, label: "REVOKED" });
    const sessions = yield* abortStaleSessions(now);

    return {
      filesDeleted: expired.succeeded + revoked.succeeded,
      sessionsAborted: sessions.succeeded,
      errors: [...expired.errors, ...revoked.errors, ...sessions.errors],
    };
  });
