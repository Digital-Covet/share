import { Cpu } from "lucide-solid";
import { createMemo, For } from "solid-js";
import type { ChunkStatus } from "@/types/upload";

const ANNOUNCE_STEP = 25;

const STATUS_CLASS: Record<ChunkStatus, string> = {
	pending: "bg-border-subtle",
	encrypting: "bg-status-warning animate-pulse motion-reduce:animate-none",
	uploading: "bg-primary",
	committed: "bg-status-success",
	failed: "bg-status-error",
};

const LABELS = {
	upload: { progress: "Encryption progress for", announced: "encrypted and uploaded", committed: "COMMITTED" },
	download: { progress: "Decryption progress for", announced: "decrypted and saved", committed: "DECRYPTED" },
} as const;

interface ChunkMatrixProps {
	totalChunks: number;
	chunkStates: ChunkStatus[];
	currentSpeedMbps: number;
	fileName: string;
	direction?: keyof typeof LABELS;
}

export function ChunkMatrix(props: ChunkMatrixProps) {
	const committedCount = createMemo(
		() => props.chunkStates.filter((s) => s === "committed").length,
	);
	const percentComplete = createMemo(() =>
		props.totalChunks > 0 ? Math.round((committedCount() / props.totalChunks) * 100) : 0,
	);
	const labels = () => LABELS[props.direction ?? "upload"];
	const announcement = createMemo(() => {
		const milestone = Math.floor(percentComplete() / ANNOUNCE_STEP) * ANNOUNCE_STEP;
		return milestone > 0 ? `${milestone}% of ${props.fileName} ${labels().announced}` : "";
	});

	return (
		<section class="w-full rounded-md border border-border bg-surface p-5 shadow-xs">
			<div class="mb-3 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Cpu class="size-4 text-primary" stroke-width={1.75} aria-hidden="true" />
					<h2 class="font-display text-sm font-bold tracking-tight text-text-main">
						AES-256-GCM CHUNK PIPELINE
					</h2>
					<span class="font-mono text-xs text-text-muted">
						({props.totalChunks} × 5 MB blocks)
					</span>
				</div>
				<div class="flex items-center gap-3 font-mono text-xs">
					<span class="font-medium text-text-muted">
						{props.currentSpeedMbps.toFixed(1)} MB/s
					</span>
					<span class="font-bold text-primary">{percentComplete()}%</span>
				</div>
			</div>

			<div
				class="grid max-h-36 gap-1 overflow-y-auto py-2"
				style={{ "grid-template-columns": "repeat(auto-fill, minmax(12px, 1fr))" }}
				role="progressbar"
				aria-valuenow={percentComplete()}
				aria-valuemin="0"
				aria-valuemax="100"
				aria-label={`${labels().progress} ${props.fileName}`}
			>
				<For each={props.chunkStates}>
					{(status, index) => (
						<div
							class={`h-3 rounded-[1px] transition-colors duration-(--duration-fast) ${STATUS_CLASS[status]}`}
							title={`Chunk ${index() + 1} of ${props.totalChunks}: ${status}`}
						/>
					)}
				</For>
			</div>

			<div class="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 font-mono text-[11px] text-text-muted">
				<span class="flex items-center gap-1.5">
					<span class="inline-block size-2 rounded-full bg-status-success" aria-hidden="true" />
					AAD: fileId || chunkIndex || totalChunks
				</span>
				<span>
					{committedCount()} / {props.totalChunks} {labels().committed}
				</span>
			</div>
			<p class="sr-only" aria-live="polite">
				{announcement()}
			</p>
		</section>
	);
}
