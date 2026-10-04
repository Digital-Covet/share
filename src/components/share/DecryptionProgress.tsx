import { ChunkMatrix } from "@/components/crypto/ChunkMatrix";
import type { ChunkStatus } from "@/types/upload";

interface DecryptionProgressProps {
	fileName: string;
	chunkStates: ChunkStatus[];
	activeChunk: number;
	speedMbps: number;
}

export function DecryptionProgress(props: DecryptionProgressProps) {
	return (
		<section class="share-fade-in">
			<ChunkMatrix
				direction="download"
				fileName={props.fileName}
				totalChunks={props.chunkStates.length}
				chunkStates={props.chunkStates}
				currentSpeedMbps={props.speedMbps}
			/>
			<p class="mt-3 text-sm text-text-main" role="status">
				Decrypting chunk {props.activeChunk + 1} of {props.chunkStates.length} in browser memory…
			</p>
			<div class="mt-2 flex justify-between gap-4 font-mono text-xs text-text-muted">
				<span>Pipeline: R2 Byte-Range → AES-GCM</span>
				<span>Throughput: {props.speedMbps.toFixed(1)} MB/s</span>
			</div>
		</section>
	);
}
