const PORTFOLIO_BASE = "https://portfolio.digitalcovet.com";
const PUBLIC_FILE_PATH = "/api/public/file";

function decodeIfNeeded(value: string): string {
	if (value.includes("%2F") || value.includes("%3D")) {
		try {
			return decodeURIComponent(value);
		} catch {
			return value;
		}
	}
	return value;
}

function extractKey(raw: string): string {
	const decoded = decodeIfNeeded(raw);

	if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
		try {
			const url = new URL(decoded);
			return url.searchParams.get("key") ?? decoded;
		} catch {
			return decoded;
		}
	}

	if (decoded.startsWith("/api/public/file")) {
		const idx = decoded.indexOf("?key=");
		return idx !== -1 ? decoded.slice(idx + 5) : decoded;
	}

	return decoded;
}

export function resolveAvatarUrl(
	raw: string | null | undefined,
): string | undefined {
	if (!raw) return undefined;
	const key = extractKey(raw);
	return `${PORTFOLIO_BASE}${PUBLIC_FILE_PATH}?key=${key}`;
}
