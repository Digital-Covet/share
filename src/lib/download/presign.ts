import { apiUrl } from "@/lib/api/url";

export interface PresignRequest {
	fileId: string;
	chunkIndex: number;
	preview: boolean;
	sessionId?: string;
	password?: string;
	signal?: AbortSignal;
}

export interface PresignedChunk {
	url: string;
	range: string;
	sessionId?: string;
}

export async function fetchPresignedUrl(request: PresignRequest): Promise<PresignedChunk> {
	const { fileId, chunkIndex, preview, sessionId, password, signal } = request;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Accept: "application/json",
	};
	// Only the first, session-less request is password-checked by the server.
	if (password) headers["x-share-password"] = password;

	const res = await fetch(apiUrl(`/api/files/${fileId}/download-urls`), {
		method: "POST",
		headers,
		body: JSON.stringify({ chunkIndices: [chunkIndex], preview, sessionId }),
		signal,
	});

	const contentType = res.headers.get("Content-Type") || "";
	const isJson = contentType.includes("application/json");

	if (!res.ok || !isJson) {
		let message = `Failed to get download URL for chunk ${chunkIndex} (HTTP ${res.status})`;
		if (isJson) {
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			message = body.error ?? message;
		}
		throw new Error(message);
	}

	const body = (await res.json()) as {
		urls: { url: string; range: string }[];
		sessionId?: string;
	};
	const [first] = body.urls;
	return { url: first.url, range: first.range, sessionId: body.sessionId };
}
