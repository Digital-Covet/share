import type {
	CompleteUploadResponse,
	InitiateUploadResponse,
	SecuritySettings,
} from "@/types/upload";

export interface InitiateRequest {
	fileName: string;
	mimeType: string;
	originalSize: number;
	totalChunks: number;
	ivBaseHash: string;
	encryptionKey: string;
	ivBase: string;
}

export interface PartEtag {
	partNumber: number;
	etag: string;
}

export interface CompleteRequest {
	fileId: string;
	encryptedSize: number;
	etags: PartEtag[];
	securitySettings: SecuritySettings;
	password: string | null;
}

export interface PartUrl {
	partNumber: number;
	url: string;
	expiresAt: string;
}

async function assertOk(res: Response, fallback: string): Promise<void> {
	if (res.ok) return;
	const body = (await res.json().catch(() => null)) as { error?: string } | null;
	throw new Error(body?.error ?? fallback);
}

async function postJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
	const res = await fetch(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	await assertOk(res, fallback);
	return (await res.json()) as T;
}

export function initiateUpload(request: InitiateRequest): Promise<InitiateUploadResponse> {
	return postJson(
		"/api/files/initiate-upload",
		{
			file_name: request.fileName,
			mime_type: request.mimeType,
			original_size: request.originalSize,
			total_chunks: request.totalChunks,
			iv_base_hash: request.ivBaseHash,
			encryption_key: request.encryptionKey,
			iv_base: request.ivBase,
		},
		"Could not start the upload.",
	);
}

export async function fetchPartUrls(fileId: string, parts: number[]): Promise<PartUrl[]> {
	const query = new URLSearchParams({ fileId });
	for (const part of parts) query.append("parts", String(part));
	const res = await fetch(`/api/files/resume-upload?${query}`);
	await assertOk(res, "Could not refresh upload URLs.");
	const { presignedUrls } = (await res.json()) as { presignedUrls: PartUrl[] };
	return presignedUrls;
}

export function completeUpload(request: CompleteRequest): Promise<CompleteUploadResponse> {
	return postJson(
		"/api/files/complete-upload",
		{
			fileId: request.fileId,
			encrypted_size: request.encryptedSize,
			etags: request.etags,
			security_settings: request.securitySettings,
			is_password_protected: request.password !== null,
			password: request.password,
		},
		"Could not finalize the upload.",
	);
}
