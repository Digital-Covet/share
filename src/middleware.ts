import { createMiddleware } from "@solidjs/start/middleware";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { hashIp } from "@/lib/ip-hash";
import type { AuthUser } from "@/types/auth";

const UserRoleSchema = z.enum(["employee", "admin", "superadmin"]).catch("employee");

const R2_ENDPOINT = "https://63a1e79156c2df895c7be8b7506e2fcb.r2.cloudflarestorage.com";

const CSP = [
  "default-src 'none'",
  `connect-src 'self' ${R2_ENDPOINT}`,
  `worker-src 'self' blob:`,
  `media-src 'self' ${R2_ENDPOINT}`,
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

export default createMiddleware({
  onRequest: async (event) => {
    const headers = new Headers(event.request.headers);

    let user: AuthUser | null = null;
    try {
      const session = await auth.api.getSession({ headers });
      if (session?.user) {
        const u = session.user;
        user = {
          id: u.id,
          email: u.email,
          name: u.name,
          image: (u.image as string | null | undefined) ?? null,
          role: UserRoleSchema.parse(u.role),
          departmentId: (u.departmentId as string | null | undefined) ?? null,
          emailVerified: u.emailVerified ?? false,
          twoFactorEnabled: u.twoFactorEnabled ?? false,
          passwordChanged: (u.passwordChanged as boolean | undefined) ?? false,
        };
      }
    } catch {
      // Invalid/expired session — treat as anon
    }

    const forwarded = headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "0.0.0.0";
    const ipHash = await hashIp(ip);

    event.locals.user = user;
    event.locals.ipHash = ipHash;
  },
  onBeforeResponse: (event) => {
    event.response.headers.set("Content-Security-Policy", CSP);
    event.response.headers.set("X-Frame-Options", "DENY");
    event.response.headers.set("X-Content-Type-Options", "nosniff");
    event.response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    event.response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  },
});
