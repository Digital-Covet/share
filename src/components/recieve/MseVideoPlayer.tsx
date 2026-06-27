import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { LoaderCircle } from "lucide-solid";
import { MseController } from "@/lib/download/mse-controller";
import type { FileMeta } from "@/lib/download/types";

interface MseVideoPlayerProps {
	fileId: string;
	mimeType: string;
	chunkSize: number;
	totalChunks: number;
	key: string;
	ivBase: Uint8Array;
	fileName: string;
}

export function MseVideoPlayer(props: MseVideoPlayerProps) {
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal("");
	const [buffering, setBuffering] = createSignal(false);

	let videoEl!: HTMLVideoElement;
	let controller: MseController | undefined;

	onMount(() => {
		const meta: FileMeta = {
			fileId: props.fileId,
			mime_type: props.mimeType,
			chunk_size: props.chunkSize,
			total_chunks: props.totalChunks,
		};

		controller = new MseController({
			meta,
			keyBase64Url: props.key,
			ivBase: props.ivBase,
			videoEl,
			onError: (err) => {
				setError(err instanceof Error ? err.message : "Playback failed");
				setLoading(false);
			},
			onBuffering: (isBuffering) => {
				setBuffering(isBuffering);
				if (!isBuffering) setLoading(false);
			},
		});

		controller.init().catch((err) => {
			setError(err instanceof Error ? err.message : "Failed to initialize player");
			setLoading(false);
		});
	});

	onCleanup(() => {
		controller?.dispose();
	});

	return (
		<div class="relative flex h-full w-full items-center justify-center bg-black">
			<video
				ref={videoEl}
				controls
				class="max-h-full max-w-full"
				preload="auto"
			>
				<track kind="captions" label="No captions" src="" default />
			</video>

			<Show when={loading()}>
				<div class="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
					<LoaderCircle class="mb-3 h-8 w-8 animate-spin text-white" />
					<p class="text-sm text-white/80">Buffering...</p>
				</div>
			</Show>

			<Show when={buffering() && !loading()}>
				<div class="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5">
					<p class="text-xs text-white/80">Buffering...</p>
				</div>
			</Show>

			<Show when={error()}>
				<div class="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
					<p class="mb-1 text-sm font-medium text-red-400">Playback error</p>
					<p class="text-xs text-white/60">{error()}</p>
				</div>
			</Show>
		</div>
	);
}
