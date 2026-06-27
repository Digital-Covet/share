import { apiUrl } from "~/lib/api/url";

export interface FileMetaResponse {
  fileId: string;
  originalName: string;
  mimeType: string;
  originalSize: string;
  iv: string;
  ivBase?: string;
  encryptionKey?: string;
  chunkSize: number;
  totalChunks: number;
  isPasswordProtected: boolean;
  maxDownloads?: number;
  downloadCount: number;
  expiresAt: string | null;
}

export interface MetaResult {
  ok: boolean;
  status: number;
  data?: FileMetaResponse;
  error?: string;
}

export async function fetchFileMeta(
  fileId: string,
  password: string,
): Promise<MetaResult> {
  const res = await fetch(
    apiUrl(`/api/files/${encodeURIComponent(fileId)}/meta`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ password }),
      cache: "no-store",
    },
  );

  const contentType = res.headers.get("Content-Type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok || !isJson) {
    let error = `Request failed with status ${res.status}`;

    if (isJson) {
      try {
        const body = (await res.json()) as { error?: string };
        error = body?.error ?? error;
      } catch {
        // Ignore JSON parse errors
      }
    } else if (contentType.includes("text/html")) {
      error = `Received HTML instead of JSON. The API endpoint may be missing or misconfigured.`;
    }

    return { ok: false, status: res.status, error };
  }

  try {
    const data = (await res.json()) as FileMetaResponse;
    return { ok: true, status: 200, data };
  } catch {
    return {
      ok: false,
      status: res.status,
      error: "Failed to parse server response as JSON.",
    };
  }
}
