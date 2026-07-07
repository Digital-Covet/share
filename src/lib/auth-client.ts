import { createAuthClient } from "better-auth/solid";
import { genericOAuthClient } from "better-auth/client/plugins";

const AUTH_BASE_URL =
	typeof window === "undefined"
		? process.env.BETTER_AUTH_URL
		: (import.meta.env.VITE_BETTER_AUTH_URL ?? window.location.origin);

export const authClient = createAuthClient({
	baseURL: AUTH_BASE_URL,
	plugins: [genericOAuthClient()],
});
