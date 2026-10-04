import { Effect } from "effect";
import { toJsonSafe } from "@/lib/dto";
import { mapFileToFileItem } from "@/lib/file-map";
import { Auth } from "@/server/effect/auth";
import { Database } from "@/server/effect/database";
import { effectRoute } from "@/server/effect/route";

export const GET = effectRoute(({ request }: { request: Request }) =>
  Effect.gen(function* () {
    const user = yield* (yield* Auth).requireUser(request);

    const files = yield* (yield* Database).use("file.listForUser", (prisma) =>
      prisma.file.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          originalSize: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          shareLinks: {
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              expiresAt: true,
              consumedAt: true,
              downloadCount: true,
              maxDownloads: true,
              isOneTime: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    return Response.json(toJsonSafe({ files: files.map(mapFileToFileItem) }));
  }),
);
