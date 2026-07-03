import { createAuthClient } from "better-auth/solid";
import { twoFactorClient } from "better-auth/client/plugins";

const AUTH_BASE_URL =
  typeof window === "undefined"
    ? process.env.BETTER_AUTH_URL
    : import.meta.env.VITE_BETTER_AUTH_URL;

export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        if (typeof window !== "undefined") {
          window.location.href = "/auth/verify-2fa";
        }
      },
    }),
  ],
});
