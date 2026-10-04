import { fetchPartUrls, type PartUrl } from "./upload-api";

const URL_BATCH = 5;
const REFRESH_MARGIN_MS = 15_000;
const MAX_ATTEMPTS = 2;

export class PartUploader {
	private readonly urls = new Map<number, PartUrl>();

	constructor(
		private readonly fileId: string,
		private readonly totalParts: number,
		seed: PartUrl[],
	) {
		for (const entry of seed) this.urls.set(entry.partNumber, entry);
	}

	async upload(partNumber: number, body: Uint8Array): Promise<string> {
		let lastError: Error = new Error("Upload failed.");
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			try {
				const url = await this.freshUrl(partNumber, attempt > 0);
				return await this.put(url, body);
			} catch (err) {
				lastError = err instanceof Error ? err : lastError;
			}
		}
		throw lastError;
	}

	private async freshUrl(partNumber: number, forceRefresh: boolean): Promise<string> {
		const cached = this.urls.get(partNumber);
		const usable =
			cached && Date.parse(cached.expiresAt) - Date.now() > REFRESH_MARGIN_MS;
		if (!forceRefresh && usable) return cached.url;
		await this.refreshBatch(partNumber);
		const refreshed = this.urls.get(partNumber);
		if (!refreshed) throw new Error("No upload URL available for this chunk.");
		return refreshed.url;
	}

	private async refreshBatch(startPart: number): Promise<void> {
		const last = Math.min(startPart + URL_BATCH - 1, this.totalParts);
		const parts = Array.from({ length: last - startPart + 1 }, (_, i) => startPart + i);
		for (const entry of await fetchPartUrls(this.fileId, parts)) {
			this.urls.set(entry.partNumber, entry);
		}
	}

	private async put(url: string, body: Uint8Array): Promise<string> {
		const res = await fetch(url, { method: "PUT", body: body as BodyInit });
		if (!res.ok) throw new Error(`Storage rejected the chunk (HTTP ${res.status}).`);
		const etag = res.headers.get("ETag");
		if (!etag) throw new Error("Storage did not expose an ETag; check bucket CORS settings.");
		return etag;
	}
}
