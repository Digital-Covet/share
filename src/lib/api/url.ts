import { APP_DOMAIN } from "~/lib/constants";

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") return cleanPath;
  const base = APP_DOMAIN.replace(/\/+$/, "");
  console.log(
    "[apiUrl][SSR] APP_DOMAIN =",
    JSON.stringify(APP_DOMAIN),
    "→",
    `${base}${cleanPath}`,
  );
  return `${base}${cleanPath}`;
}
