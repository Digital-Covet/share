const DEFAULT_REDIRECT = "/dashboard";

/**
 * The login redirect param arrives as a full URL from the middleware.
 * Only same-origin paths are honoured so it cannot be used as an open redirect.
 */
export function resolveSafeRedirect(
	raw: string | undefined,
	origin: string,
): string {
	if (!raw) return DEFAULT_REDIRECT;

	try {
		const target = new URL(raw, origin);
		if (target.origin !== origin) return DEFAULT_REDIRECT;
		if (target.pathname.startsWith("/auth/")) return DEFAULT_REDIRECT;
		return `${target.pathname}${target.search}${target.hash}`;
	} catch {
		return DEFAULT_REDIRECT;
	}
}
