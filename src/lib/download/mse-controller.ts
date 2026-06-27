import { apiUrl } from "@/lib/api/url";
import { importKeyFromBase64Url } from "@/lib/crypto";
import { deriveIV } from "@/lib/crypto/iv";
import { decryptChunk } from "@/lib/crypto/decrypt";
import type { FileMeta } from "./types";

const INITIAL_BUFFER_CHUNKS = 6;
const BUFFER_LOW_WATERMARK = 2;
const BUFFER_HIGH_WATERMARK = 8;

const COMMON_CODECS = [
	'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
	'video/mp4; codecs="avc1.4D401E, mp4a.40.2"',
	'video/mp4; codecs="avc1.64001E, mp4a.40.2"',
	'video/mp4; codecs="hev1.1.6.L93.B0, mp4a.40.2"',
];

function probeCodec(): string {
	for (const codec of COMMON_CODECS) {
		if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(codec)) {
			return codec;
		}
	}
	return COMMON_CODECS[0];
}

function encodeAAD(fileId: string, chunkIndex: number, totalChunks: number): Uint8Array {
	return new TextEncoder().encode(JSON.stringify({ fileId, chunkIndex, totalChunks }));
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	const buf = new ArrayBuffer(view.byteLength);
	new Uint8Array(buf).set(view);
	return buf;
}

async function fetchAndDecrypt(
	meta: FileMeta,
	key: CryptoKey,
	ivBase: Uint8Array,
	chunkIndex: number,
	signal?: AbortSignal,
): Promise<Uint8Array> {
	const presignedRes = await fetch(apiUrl(`/api/files/${meta.fileId}/download-urls`), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ chunkIndices: [chunkIndex], preview: true }),
		signal,
	});

	if (!presignedRes.ok) {
		const body = await presignedRes.json().catch(() => ({}));
		throw new Error(body.error ?? `Failed to get download URL for chunk ${chunkIndex}`);
	}

	const { urls } = (await presignedRes.json()) as { urls: { url: string; range: string }[] };
	const [{ url, range }] = urls;

	const encRes = await fetch(url, { headers: { Range: range }, signal });
	if (!encRes.ok) throw new Error(`Failed to fetch chunk ${chunkIndex}: ${encRes.status}`);
	const encrypted = new Uint8Array(await encRes.arrayBuffer());

	const iv = deriveIV(ivBase, chunkIndex);
	const aad = encodeAAD(meta.fileId, chunkIndex, meta.total_chunks);
	return decryptChunk(key, iv, aad, encrypted);
}

export interface MseControllerOptions {
	meta: FileMeta;
	keyBase64Url: string;
	ivBase: Uint8Array;
	videoEl: HTMLVideoElement;
	onError?: (err: unknown) => void;
	onBuffering?: (buffering: boolean) => void;
}

export class MseController {
	private ms: MediaSource | null = null;
	private sb: SourceBuffer | null = null;
	private key: CryptoKey | null = null;
	private abortCtl: AbortController | null = null;

	private meta: FileMeta;
	private ivBase: Uint8Array;
	private videoEl: HTMLVideoElement;
	private onError?: (err: unknown) => void;
	private onBuffering?: (buffering: boolean) => void;
	private keyBase64Url: string;

	private appendedChunks = new Set<number>();
	private decryptedLengths: number[] = [];
	private fetching = false;
	private sourceOpen = false;
	private disposed = false;
	private userSeekTarget: number | null = null;

	constructor(opts: MseControllerOptions) {
		this.meta = opts.meta;
		this.ivBase = opts.ivBase;
		this.videoEl = opts.videoEl;
		this.onError = opts.onError;
		this.onBuffering = opts.onBuffering;
		this.keyBase64Url = opts.keyBase64Url;
	}

	async init(): Promise<void> {
		this.key = await importKeyFromBase64Url(this.keyBase64Url);

		this.ms = new MediaSource();
		this.videoEl.src = URL.createObjectURL(this.ms);

		this.ms.addEventListener("sourceopen", () => {
			this.sourceOpen = true;

			const codec = probeCodec();
			const ms = this.ms;
			if (!ms) return;

			try {
				this.sb = ms.addSourceBuffer(codec);
			} catch {
				this.onError?.(new Error(`Codec not supported: ${codec}`));
				return;
			}

			this.sb.mode = "segments";
			this.sb.addEventListener("updateend", this.onUpdateEnd);
			this.videoEl.addEventListener("seeking", this.onSeeking);

			this.fetchChunks(INITIAL_BUFFER_CHUNKS);
		});
	}

	private onUpdateEnd = () => {
		if (this.disposed) return;

		if (this.userSeekTarget !== null) {
			this.videoEl.currentTime = this.userSeekTarget;
			this.userSeekTarget = null;
		}

		this.removeOldBuffers();
		this.maybeFetchMore();
	};

	private onSeeking = () => {
		if (this.disposed || !this.sb || !this.sourceOpen) return;

		const target = this.videoEl.currentTime;
		const chunkIdx = this.timeToChunkIndex(target);

		if (chunkIdx === -1) return;
		if (this.appendedChunks.has(chunkIdx)) return;

		this.userSeekTarget = target;
		this.fetchChunks(chunkIdx, Math.min(chunkIdx + BUFFER_HIGH_WATERMARK, this.meta.total_chunks));
	};

	private timeToChunkIndex(time: number): number {
		if (this.decryptedLengths.length === 0) return 0;

		let byteOffset = 0;
		for (let i = 0; i < this.meta.total_chunks; i++) {
			const chunkLen = this.decryptedLengths[i] ?? this.meta.chunk_size;
			if (time >= 0 && byteOffset <= time * 1000) {
				if (byteOffset + chunkLen > time * 1000) {
					return i;
				}
			}
			byteOffset += chunkLen;
		}
		return this.meta.total_chunks - 1;
	}

	private fetchChunks(from: number, to?: number): void {
		if (this.fetching || this.disposed || !this.sb || !this.sourceOpen) return;

		const end = to ?? Math.min(from + BUFFER_HIGH_WATERMARK, this.meta.total_chunks);
		const indices: number[] = [];
		for (let i = from; i < end; i++) {
			if (!this.appendedChunks.has(i)) {
				indices.push(i);
			}
		}

		if (indices.length === 0) return;

		this.fetching = true;
		this.onBuffering?.(true);
		this.abortCtl = new AbortController();

		this.fetchAndAppend(indices, this.abortCtl.signal).catch((err) => {
			if (this.disposed) return;
			if (err instanceof DOMException && err.name === "AbortError") return;
			this.onError?.(err);
		}).finally(() => {
			this.fetching = false;
			this.onBuffering?.(false);
		});
	}

	private async fetchAndAppend(indices: number[], signal: AbortSignal): Promise<void> {
		for (const idx of indices) {
			if (this.disposed || signal.aborted) break;

			while (this.sb?.updating) {
				await new Promise((r) => {
					this.sb?.addEventListener("updateend", r, { once: true });
				});
				if (this.disposed || signal.aborted) return;
			}

			if (this.disposed || !this.key || !this.sb || !this.sourceOpen) return;

			const plain = await fetchAndDecrypt(this.meta, this.key, this.ivBase, idx, signal);

			if (signal.aborted) return;

			this.decryptedLengths[idx] = plain.byteLength;
			this.appendedChunks.add(idx);

			this.sb.appendBuffer(toArrayBuffer(plain));

			await new Promise<void>((resolve) => {
				const sb = this.sb;
				if (!sb) { resolve(); return; }
				sb.addEventListener("updateend", () => resolve(), { once: true });
			});

			if (this.disposed) return;

			this.removeOldBuffers();
		}
	}

	private removeOldBuffers(): void {
		if (!this.sb || this.sb.updating || this.disposed) return;

		const currentTime = this.videoEl.currentTime;
		const removeEnd = currentTime - 5;
		if (removeEnd <= 0) return;

		if (this.sb.buffered.length > 0) {
			const start = this.sb.buffered.start(0);
			if (removeEnd > start + 5) {
				try {
					this.sb.remove(start, removeEnd);
				} catch {
					// MSE may throw if range is invalid
				}
			}
		}
	}

	private maybeFetchMore(): void {
		if (this.disposed || !this.sb || this.sb.updating) return;

		const currentTime = this.videoEl.currentTime;
		const bufferedEnd = this.getBufferedEnd();

		if (bufferedEnd - currentTime < BUFFER_LOW_WATERMARK) {
			const nextChunk = this.chunkIndexAfterTime(bufferedEnd);
			if (nextChunk < this.meta.total_chunks) {
				this.fetchChunks(nextChunk);
			}
		}
	}

	private getBufferedEnd(): number {
		if (!this.sb || this.sb.buffered.length === 0) return 0;
		return this.sb.buffered.end(this.sb.buffered.length - 1);
	}

	private chunkIndexAfterTime(time: number): number {
		let byteOffset = 0;
		for (let i = 0; i < this.meta.total_chunks; i++) {
			const chunkLen = this.decryptedLengths[i] ?? this.meta.chunk_size;
			if (byteOffset >= time * 1000) {
				return i;
			}
			byteOffset += chunkLen;
		}
		return this.meta.total_chunks;
	}

	dispose(): void {
		this.disposed = true;
		this.abortCtl?.abort();

		if (this.sb) {
			this.sb.removeEventListener("updateend", this.onUpdateEnd);
		}
		this.videoEl.removeEventListener("seeking", this.onSeeking);

		if (this.ms?.readyState === "open") {
			try {
				this.ms.endOfStream();
			} catch {
				// may throw if already ended
			}
		}

		if (this.videoEl.src) {
			URL.revokeObjectURL(this.videoEl.src);
			this.videoEl.removeAttribute("src");
			this.videoEl.load();
		}

		this.ms = null;
		this.sb = null;
	}
}
