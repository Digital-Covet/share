import { createSignal } from "solid-js";
import type { StreamProgress } from "@/lib/download/stream-to-disk";
import type { ChunkStatus } from "@/types/upload";

const BYTES_PER_MB = 1024 * 1024;

export function useDecryptProgress() {
	const [chunkStates, setChunkStates] = createSignal<ChunkStatus[]>([]);
	const [speedMbps, setSpeedMbps] = createSignal(0);
	const [activeChunk, setActiveChunk] = createSignal(0);
	let startedAt = 0;
	let fetchedBytes = 0;

	function reset(totalChunks: number) {
		setChunkStates(Array.from({ length: totalChunks }, () => "pending"));
		setSpeedMbps(0);
		setActiveChunk(0);
		startedAt = performance.now();
		fetchedBytes = 0;
	}

	function mark(index: number, status: ChunkStatus) {
		setChunkStates((states) => states.map((s, i) => (i === index ? status : s)));
	}

	function recordBytes(bytes: number) {
		fetchedBytes += bytes;
		const seconds = (performance.now() - startedAt) / 1000;
		if (seconds > 0) setSpeedMbps(fetchedBytes / BYTES_PER_MB / seconds);
	}

	// The stream emits no per-chunk "committed" event: a chunk is done once the next one starts.
	function onProgress(event: StreamProgress) {
		if (event.type === "done") {
			setChunkStates((states) => states.map(() => "committed"));
			return;
		}
		if (event.chunkIndex === undefined) return;
		const index = event.chunkIndex;

		if (event.type === "decrypting") {
			mark(index, "encrypting");
			return;
		}

		if (event.type !== "progress") return;
		if (event.loaded === 0) {
			setActiveChunk(index);
			if (index > 0) mark(index - 1, "committed");
			mark(index, "uploading");
			return;
		}
		recordBytes(event.loaded ?? 0);
	}

	return { chunkStates, speedMbps, activeChunk, reset, onProgress };
}
