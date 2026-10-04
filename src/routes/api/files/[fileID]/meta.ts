import { Effect, Predicate } from "effect";
import type { FileMetaResponse } from "@/lib/api/meta";
import { bigIntReplacer } from "@/lib/dto";
import { rateLimit } from "@/lib/rate-limit";
import { deriveShareLinkStatus } from "@/lib/share-link";
import { Database } from "@/server/effect/database";
import { BadRequest, Gone, NotFound, RateLimited, Unauthorized } from "@/server/effect/errors";
import { verifyPasswordEffect } from "@/server/effect/passwords";
import { effectRoute, readJson } from "@/server/effect/route";
import type { FileStatus } from "@/types/dashboard";
import type { UnavailableReason } from "@/types/share";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const UNAVAILABLE_REASON_BY_STATUS: Partial<Record<FileStatus, UnavailableReason>> = {
  Revoked: "revoked",
  Expired: "expired",
  Consumed: "consumed",
};

function getClientIP(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

function getUnavailableReason(
  link: Parameters<typeof deriveShareLinkStatus>[0] & { file: { status: string } },
): UnavailableReason | undefined {
  if (link.file.status !== "READY") return "expired";
  return UNAVAILABLE_REASON_BY_STATUS[deriveShareLinkStatus(link)];
}

const passwordFrom = (body: unknown): string =>
  Predicate.isObject(body) && typeof body.password === "string" ? body.password : "";

const enforceRateLimit = Effect.fnUntraced(function* (options: {
  ip: string;
  fileId: string;
}) {
  const result = yield* Effect.promise(() =>
    rateLimit({
      key: `meta:${options.ip}:${options.fileId}`,
      limit: RATE_LIMIT_MAX,
      window: RATE_LIMIT_WINDOW_SECONDS,
    }),
  );
  if (!result.success) {
    return yield* new RateLimited({
      message: "Too many requests",
      headers: {
        "Retry-After": String(Math.max(1, result.reset - Math.floor(Date.now() / 1000))),
        "X-RateLimit-Remaining": "0",
      },
    });
  }
  return result;
});

const loadShareLink = (fileId: string) =>
  Effect.flatMap(Database, (db) =>
    db.use("shareLink.findForMeta", (prisma) =>
      prisma.shareLink.findUnique({
        where: { id: fileId },
        select: {
          id: true,
          status: true,
          isOneTime: true,
          consumedAt: true,
          isPasswordProtected: true,
          passwordHash: true,
          maxDownloads: true,
          downloadCount: true,
          expiresAt: true,
          file: {
            select: {
              id: true,
              status: true,
              fileName: true,
              mimeType: true,
              originalSize: true,
              ivBaseHash: true,
              ivBase: true,
              encryptionKey: true,
              chunkSize: true,
              totalChunks: true,
            },
          },
        },
      }),
    ),
  );

const verifySharePassword = Effect.fnUntraced(function* (options: {
  shareLinkId: string;
  passwordHash: string | null;
  password: string;
  remainingRequests: number;
}) {
  if (!options.passwordHash) {
    // Fail closed: a protected link without a hash must never be served.
    return yield* Effect.die(
      new Error(
        `DB inconsistency: shareLink ${options.shareLinkId} isPasswordProtected=true but passwordHash is null`,
      ),
    );
  }
  const ok = yield* verifyPasswordEffect({
    password: options.password,
    stored: options.passwordHash,
  });
  if (!ok) {
    return yield* new Unauthorized({
      message: "Invalid password",
      headers: { "X-RateLimit-Remaining": String(options.remainingRequests) },
    });
  }
});

export const POST = effectRoute(
  ({ request, params }: { request: Request; params: { fileID: string } }) =>
    Effect.gen(function* () {
      const { fileID } = params;
      if (!fileID) return yield* new BadRequest({ message: "Missing fileID" });

      const rate = yield* enforceRateLimit({ ip: getClientIP(request), fileId: fileID });
      const body = yield* readJson(request);

      const link = yield* loadShareLink(fileID);
      if (!link?.file) return yield* new NotFound({ message: "Not found" });

      // Checked before the password so dead links never prompt for one.
      const reason = getUnavailableReason(link);
      if (reason) {
        return yield* new Gone({ message: "Transfer unavailable", details: { reason } });
      }

      if (link.isPasswordProtected) {
        yield* verifySharePassword({
          shareLinkId: fileID,
          passwordHash: link.passwordHash,
          password: passwordFrom(body),
          remainingRequests: rate.remaining,
        });
      }

      const response: FileMetaResponse = {
        fileId: link.file.id,
        originalName: link.file.fileName,
        mimeType: link.file.mimeType,
        originalSize: link.file.originalSize.toString(),
        iv: link.file.ivBaseHash,
        ivBase: link.file.ivBase ?? undefined,
        encryptionKey: link.file.encryptionKey ?? undefined,
        chunkSize: link.file.chunkSize,
        totalChunks: link.file.totalChunks,
        isPasswordProtected: link.isPasswordProtected,
        maxDownloads: link.maxDownloads ?? undefined,
        downloadCount: link.downloadCount,
        expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
      };

      return new Response(JSON.stringify(response, bigIntReplacer), {
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      });
    }),
  { headers: { "Cache-Control": "no-store" } },
);
