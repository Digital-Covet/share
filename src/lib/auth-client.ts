import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/solid";

export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined" ? process.env.BETTER_AUTH_URL : undefined,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.replace("/auth/verify-2fa");
      },
    }),
    emailOTPClient(),
  ],
});
