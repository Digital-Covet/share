import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/project", () => ({ prisma: {} }));

const { purgeExpiredFiles } = await import("./purge-expired");
const { Database } = await import("./effect/database");
const { Storage } = await import("./effect/storage");

interface FakeFile {
  id: string;
  userId: string | null;
  totalChunks: number;
}

const fakeDatabase = (options: { ready: FakeFile[]; revoked: FakeFile[] }) => {
  const markedDeleted: string[] = [];
  const prisma = {
    file: {
      findMany: async ({ where }: { where: { status: string } }) =>
        where.status === "READY" ? options.ready : options.revoked,
      update: async ({ where }: { where: { id: string } }) => {
        markedDeleted.push(where.id);
      },
    },
    uploadSession: { findMany: async () => [] },
  };
  const layer = Layer.succeed(Database)({
    use: (_operation, run) => Effect.promise(() => run(prisma as never)),
  });
  return { layer, markedDeleted };
};

const fakeStorage = (failingFileIds: ReadonlySet<string>) =>
  Layer.succeed(Storage)({
    deleteFileObjects: ({ fileId }: { fileId: string }) =>
      Effect.succeed(failingFileIds.has(fileId) ? [`file: R2 unavailable`] : []),
  } as never);

describe("purgeExpiredFiles", () => {
  it("marks files deleted and reports failures without stopping the batch", async () => {
    const db = fakeDatabase({
      ready: [
        { id: "ok", userId: "u1", totalChunks: 1 },
        { id: "stuck", userId: "u1", totalChunks: 3 },
      ],
      revoked: [{ id: "revoked", userId: "u2", totalChunks: 1 }],
    });

    const report = await Effect.runPromise(
      purgeExpiredFiles.pipe(
        Effect.provide(Layer.merge(db.layer, fakeStorage(new Set(["stuck"])))),
      ),
    );

    expect(db.markedDeleted.sort()).toEqual(["ok", "revoked"]);
    expect(report.filesDeleted).toBe(2);
    expect(report.sessionsAborted).toBe(0);
    expect(report.errors).toEqual(["delete READY stuck: file: R2 unavailable"]);
  });
});
