import type { FileItem } from "@/types/dashboard";

async function assertOk(res: Response, fallback: string): Promise<void> {
	if (res.ok) return;
	const body = (await res.json().catch(() => null)) as { error?: string } | null;
	throw new Error(body?.error ?? fallback);
}

export async function fetchFiles(): Promise<FileItem[]> {
	const res = await fetch("/api/files");
	await assertOk(res, "Could not load your files.");
	const { files } = (await res.json()) as { files: FileItem[] };
	return files;
}

export interface ExpiryUpdate {
	fileId: string;
	expiresAt: number;
	isOneTime: boolean;
}

export async function updateExpiry({
	fileId,
	expiresAt,
	isOneTime,
}: ExpiryUpdate): Promise<void> {
	const res = await fetch(`/api/files/${fileId}/update-expiry`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ expiresAt, isOneTime }),
	});
	await assertOk(res, "Could not update the expiry.");
}

export async function revokeFile(fileId: string): Promise<void> {
	const res = await fetch(`/api/files/${fileId}/delete`, { method: "POST" });
	await assertOk(res, "Could not revoke the file.");
}

export function shareUrl(shareLinkId: string): string {
	return `${window.location.origin}/s/${shareLinkId}`;
}
