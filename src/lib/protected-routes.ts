import { ROUTES } from "./constants";

const PROTECTED_PREFIXES: readonly string[] = [
  ROUTES.DASHBOARD,
  ROUTES.UPLOAD,
  ROUTES.RECIEVE,
];

export function isProtectedRoute(pathname: string): boolean {
  if (pathname === "/") return true;

  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
