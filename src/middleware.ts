import { createMiddleware } from "@solidjs/start/middleware";
import { hashIp } from "@/lib/ip-hash";
import { getSession } from "@/lib/auth.server";

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

const PROTECTED_ROUTES = ["/dashboard", "/upload"];

function isProtectedRoute(pathname: string): boolean {
  if (pathname === "/") return true;

  return PROTECTED_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default createMiddleware({
  onRequest: async (event) => {
    const headers = new Headers(event.request.headers);

    const forwarded = headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "0.0.0.0";
    const ipHash = await hashIp(ip);

    event.locals.user = null;
    event.locals.ipHash = ipHash;

    const url = new URL(event.request.url);

    // Skip auth check for API routes (they handle their own auth via requireUser)
    if (url.pathname.startsWith("/api/")) {
      return;
    }

    if (isProtectedRoute(url.pathname)) {
      const session = await getSession(event.request);
      if (!session?.user) {
        const loginUrl = new URL("/auth/login", url.origin);
        loginUrl.searchParams.set("redirect", url.href);
        return new Response(null, {
          status: 302,
          headers: { Location: loginUrl.href },
        });
      }
      event.locals.user = session.user;
    }
  },
  onBeforeResponse: (event) => {
    event.response.headers.set("Content-Security-Policy", CSP);
    event.response.headers.set("X-Frame-Options", "DENY");
    event.response.headers.set("X-Content-Type-Options", "nosniff");
    event.response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    event.response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  },
});
