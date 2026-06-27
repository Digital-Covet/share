import { prisma } from "@/db/project";
import type { FileMetaResponse } from "@/lib/api/meta";
import { verifyPassword } from "@/lib/crypto/password";
import { bigIntReplacer } from "@/lib/dto";
import { rateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

function getClientIP(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

function noStore(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body, bigIntReplacer), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST({
  request,
  params,
}: {
  request: Request;
  params: { fileID: string };
}): Promise<Response> {
  const fileID = params.fileID;
  if (!fileID) {
    return noStore({ error: "Missing fileID" }, { status: 400 });
  }

  // --- 1. Rate limit (IP-based, per file) ---
  const ip = getClientIP(request);
  const rl = await rateLimit({
    key: `meta:${ip}:${fileID}`,
    limit: RATE_LIMIT_MAX,
    window: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!rl.success) {
    return noStore(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, rl.reset - Math.floor(Date.now() / 1000)),
          ),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  // --- 2. Parse JSON body (password lives here, NOT in headers) ---
  let body: { password?: string } = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    return noStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  // --- 3. Fetch share link + file metadata ---
  const link = await prisma.shareLink.findUnique({
    where: { id: fileID },
    select: {
      id: true,
      isPasswordProtected: true,
      passwordHash: true,
      maxDownloads: true,
      downloadCount: true,
      expiresAt: true,
      file: {
        select: {
          id: true,
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
  });

  console.log("PARAM", fileID);
  console.log("LINK", link);
  console.log("FILE", link?.file);

  if (!link || !link.file) {
    return noStore({ error: "Not found" }, { status: 404 });
  }

  // --- 4. Password verification (fail-closed on DB inconsistency) ---
  if (link.isPasswordProtected) {
    if (!link.passwordHash) {
      console.error(
        `[meta] DB inconsistency: shareLink ${fileID} isPasswordProtected=true but passwordHash is null`,
      );
      return noStore({ error: "Server error" }, { status: 500 });
    }

    const password = typeof body.password === "string" ? body.password : "";
    const ok = await verifyPassword(password, link.passwordHash);
    if (!ok) {
      return noStore(
        { error: "Invalid password" },
        {
          status: 401,
          headers: { "X-RateLimit-Remaining": String(rl.remaining) },
        },
      );
    }
  }

  // --- 5. Build camelCase DTO (BigInts as strings) ---
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
      "Cache-Control": "no-store",
      "X-RateLimit-Remaining": String(rl.remaining),
    },
  });
}
