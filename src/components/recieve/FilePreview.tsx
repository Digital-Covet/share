import { Progress } from "@ark-ui/solid/progress";
import {
	Download,
	Eye,
	FileArchive,
	FileCode,
	FileImage,
	FileText,
	FileVideo,
	AlertTriangle,
	PackageOpen,
	LoaderCircle,
} from "lucide-solid";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { extractZip } from "@/lib/compression";
import { hasPdfEOF } from "@/lib/download/pdf-trailer";
import { downloadPipeline, inferCategory } from "@/lib/download/pipeline";
import {
	supportsFileSystemAccess,
	streamDownloadToDisk,
	streamDownloadToBlob,
	type StreamProgress,
} from "@/lib/download/stream-to-disk";
import type { DownloadResult, FileMeta } from "@/lib/download/types";
import { formatFileSize } from "@/utils/upload";
import { MseVideoPlayer } from "./MseVideoPlayer";

interface FilePreviewProps {
	fileId: string;
	mimeType: string;
	chunkSize: number;
	totalChunks: number;
	key: string;
	ivBase: Uint8Array;
	fileName: string;
	originalSize: string;
}

type PreviewState = "loading" | "ready" | "error" | "unsupported";

interface ExtractedFile {
	name: string;
	data: Uint8Array;
	blobUrl: string;
}

async function consumePipeline(
	gen: AsyncGenerator<unknown, DownloadResult>,
): Promise<DownloadResult> {
	let step = await gen.next();
	while (!step.done) {
		step = await gen.next();
	}
	return step.value;
}

function getFileIcon(mimeType: string) {
	const category = inferCategory(mimeType);
	switch (category) {
		case "image":
			return FileImage;
		case "pdf":
			return FileText;
		case "video":
			return FileVideo;
		case "archive":
			return FileArchive;
		default:
			if (mimeType.startsWith("text/") || mimeType === "application/json")
				return FileCode;
			return FileText;
	}
}

function getFileIconColor(mimeType: string): string {
	const category = inferCategory(mimeType);
	switch (category) {
		case "image":
			return "text-violet-500";
		case "pdf":
			return "text-red-500";
		case "video":
			return "text-blue-500";
		case "archive":
			return "text-amber-500";
		default:
			if (mimeType.startsWith("text/") || mimeType === "application/json")
				return "text-emerald-500";
			return "text-muted-foreground";
	}
}

function getFileTypeLabel(mimeType: string): string {
	const map: Record<string, string> = {
		"application/zip": "ZIP Archive",
		"application/pdf": "PDF Document",
		"image/png": "PNG Image",
		"image/jpeg": "JPEG Image",
		"image/gif": "GIF Image",
		"image/webp": "WebP Image",
		"video/mp4": "MP4 Video",
		"video/webm": "WebM Video",
		"video/quicktime": "MOV Video",
		"text/plain": "Text File",
		"application/json": "JSON File",
	};
	if (mimeType.startsWith("image/")) return "Image";
	if (mimeType.startsWith("video/")) return "Video";
	if (mimeType.startsWith("text/")) return "Text File";
	return map[mimeType] ?? "File";
}

export function FilePreview(props: FilePreviewProps) {
	const [state, setState] = createSignal<PreviewState>("loading");
	const [src, setSrc] = createSignal("");
	const [text, setText] = createSignal("");
	const [error, setError] = createSignal("");
	const [progress, setProgress] = createSignal(0);
	const [extractedFiles, setExtractedFiles] = createSignal<ExtractedFile[]>([]);
	const [downloadProgress, setDownloadProgress] = createSignal(0);
	const [isDownloading, setIsDownloading] = createSignal(false);

	let abortController: AbortController | undefined;

	const meta = (): FileMeta => ({
		fileId: props.fileId,
		mime_type: props.mimeType,
		chunk_size: props.chunkSize,
		total_chunks: props.totalChunks,
	});

	const onProgress = (event: { type: string; chunkIndex?: number }) => {
		if (event.type === "progress" && event.chunkIndex !== undefined) {
			setProgress(
				Math.round(((event.chunkIndex + 1) / props.totalChunks) * 100),
			);
		}
	};

	const loadPreview = async () => {
		abortController = new AbortController();
		const category = inferCategory(props.mimeType);

		try {
			if (category === "archive") {
				await loadArchive();
			} else if (category === "image") {
				await loadSingleChunk(0);
			} else if (category === "pdf") {
				await loadPdfChunks();
			} else if (category === "video") {
				setState("ready");
			} else if (
				props.mimeType.startsWith("text/") ||
				props.mimeType === "application/json"
			) {
				await loadTextChunk(0);
			} else {
				setState("unsupported");
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") return;
			console.error("Preview failed:", err);
			setError(err instanceof Error ? err.message : "Preview failed");
			setState("error");
		}
	};

	const loadArchive = async () => {
		const chunkIndices = Array.from({ length: props.totalChunks }, (_, i) => i);
		const gen = downloadPipeline(
			meta(),
			props.key,
			chunkIndices,
			props.ivBase,
			props.fileName,
			onProgress,
			abortController?.signal,
			true,
		);
		const result = await consumePipeline(gen);
		const zipBytes = new Uint8Array(await result.blob.arrayBuffer());
		const files = await extractZip(zipBytes);

		const extracted = files.map((f) => ({
			...f,
			blobUrl: URL.createObjectURL(
				new Blob([f.data.slice()], { type: "application/octet-stream" }),
			),
		}));

		setExtractedFiles(extracted);
		setState("ready");
	};

	const loadSingleChunk = async (index: number) => {
		const gen = downloadPipeline(
			meta(),
			props.key,
			[index],
			props.ivBase,
			props.fileName,
			onProgress,
			abortController?.signal,
			true,
		);
		const result = await consumePipeline(gen);
		setSrc(result.blobUrl);
		setState("ready");
	};

	const loadTextChunk = async (index: number) => {
		const gen = downloadPipeline(
			meta(),
			props.key,
			[index],
			props.ivBase,
			props.fileName,
			onProgress,
			abortController?.signal,
			true,
		);
		const result = await consumePipeline(gen);
		setText(new TextDecoder().decode(await result.blob.arrayBuffer()));
		setState("ready");
	};

	const loadPdfChunks = async () => {
		const chunks: Uint8Array[] = [];
		let totalBytes = 0;

		for (let i = 0; i < props.totalChunks; i++) {
			setProgress(Math.round(((i + 1) / props.totalChunks) * 100));

			const gen = downloadPipeline(
				meta(),
				props.key,
				[i],
				props.ivBase,
				props.fileName,
				undefined,
				abortController?.signal,
				true,
			);
			const result = await consumePipeline(gen);
			const bytes = new Uint8Array(await result.blob.arrayBuffer());
			chunks.push(bytes);
			totalBytes += bytes.byteLength;

			if (hasPdfEOF(bytes)) {
				break;
			}
		}

		const merged = new Uint8Array(totalBytes);
		let offset = 0;
		for (const part of chunks) {
			merged.set(part, offset);
			offset += part.byteLength;
		}

		const blob = new Blob([merged], { type: "application/pdf" });
		setSrc(URL.createObjectURL(blob));
		setState("ready");
	};

	const handleStreamDownload = async () => {
		if (isDownloading()) return;
		setIsDownloading(true);
		setDownloadProgress(0);

		const onStreamProgress = (event: StreamProgress) => {
			if (event.type === "progress" && event.chunkIndex !== undefined) {
				setDownloadProgress(
					Math.round(((event.chunkIndex + 1) / props.totalChunks) * 100),
				);
			}
		};

		try {
			if (supportsFileSystemAccess()) {
				await streamDownloadToDisk(
					meta(),
					props.key,
					props.fileName,
					props.ivBase,
					onStreamProgress,
				);
			} else {
				const { blob, blobUrl } = await streamDownloadToBlob(
					meta(),
					props.key,
					props.fileName,
					props.ivBase,
					onStreamProgress,
				);
				const a = document.createElement("a");
				a.href = blobUrl;
				a.download = props.fileName;
				a.click();
				URL.revokeObjectURL(blobUrl);
				void blob;
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") return;
			console.error("Download failed:", err);
			setError(err instanceof Error ? err.message : "Download failed");
		} finally {
			setIsDownloading(false);
		}
	};

	const handleDownload = (file: ExtractedFile) => {
		const a = document.createElement("a");
		a.href = file.blobUrl;
		a.download = file.name;
		a.click();
	};

	const handleDownloadAll = () => {
		const extracted = extractedFiles();
		if (extracted.length === 0) return;
		if (extracted.length === 1) {
			handleDownload(extracted[0]);
			return;
		}
		const archiveBlob = new Blob(
			extracted.map((f) => f.data.slice()),
			{ type: "application/zip" },
		);
		const a = document.createElement("a");
		a.href = URL.createObjectURL(archiveBlob);
		a.download = props.fileName || "files.zip";
		a.click();
	};

	const FileIcon = () => {
		const Icon = getFileIcon(props.mimeType);
		const color = getFileIconColor(props.mimeType);
		return <Icon class={`h-5 w-5 shrink-0 ${color}`} />;
	};

	loadPreview();

	onCleanup(() => {
		abortController?.abort();
		if (src()) URL.revokeObjectURL(src());
		for (const f of extractedFiles()) {
			URL.revokeObjectURL(f.blobUrl);
		}
	});

	return (
		<div class="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
			{/* Header */}
			<div class="flex items-center gap-3 border-b border-border bg-card px-5 py-3.5">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/50">
					<FileIcon />
				</div>
				<div class="min-w-0 flex-1">
					<h3
						class="truncate text-sm font-semibold text-foreground"
						title={props.fileName}
					>
						{props.fileName}
					</h3>
					<div class="mt-0.5 flex items-center gap-2">
						<span class="text-xs text-muted-foreground">
							{getFileTypeLabel(props.mimeType)}
						</span>
						<span class="h-1 w-1 rounded-full bg-border" />
						<span class="text-xs text-muted-foreground">
							{formatFileSize(Number(props.originalSize ?? 0))}
						</span>
					</div>
				</div>
				<Show when={state() === "ready"}>
					<button
						onClick={handleStreamDownload}
						disabled={isDownloading()}
						class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
					>
						<Show
							when={isDownloading()}
							fallback={<Download class="h-3.5 w-3.5" />}
						>
							<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
							{downloadProgress()}%
						</Show>
						<span class="hidden sm:inline">Download</span>
					</button>
				</Show>
			</div>

			{/* Preview content */}
			<div class="relative flex-1 overflow-hidden">
				<Show when={state() === "loading"}>
					<div class="flex h-full flex-col items-center justify-center gap-4 px-6">
						<div class="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary/50">
							<LoaderCircle class="h-7 w-7 animate-spin text-primary" />
						</div>
						<div class="w-full max-w-xs">
							<Progress.Root value={progress()} max={100}>
								<Progress.Track class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
									<Progress.Range class="h-full rounded-full bg-primary transition-all duration-300 ease-out" />
								</Progress.Track>
							</Progress.Root>
						</div>
						<p class="text-center text-xs text-muted-foreground">
							{props.mimeType === "application/zip"
								? `Extracting files... ${progress()}%`
								: `Decrypting and loading preview... ${progress()}%`}
						</p>
					</div>
				</Show>

				<Show when={state() === "error"}>
					<div class="flex h-full flex-col items-center justify-center gap-3 px-6">
						<div class="flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10">
							<AlertTriangle class="h-7 w-7 text-destructive" />
						</div>
						<div class="text-center">
							<p class="text-sm font-medium text-foreground">
								Preview unavailable
							</p>
							<p class="mt-1 max-w-xs text-xs text-muted-foreground">
								{error()}
							</p>
						</div>
						<button
							onClick={handleStreamDownload}
							disabled={isDownloading()}
							class="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
						>
							<Download class="h-3.5 w-3.5" />
							Download instead
						</button>
					</div>
				</Show>

				<Show when={state() === "unsupported"}>
					<div class="flex h-full flex-col items-center justify-center gap-3 px-6">
						<div class="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary/50">
							<PackageOpen class="h-7 w-7 text-muted-foreground" />
						</div>
						<div class="text-center">
							<p class="text-sm font-medium text-foreground">
								Preview not supported
							</p>
							<p class="mt-1 text-xs text-muted-foreground">
								{getFileTypeLabel(props.mimeType)} ({props.mimeType})
							</p>
						</div>
						<button
							onClick={handleStreamDownload}
							disabled={isDownloading()}
							class="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
						>
							<Download class="h-3.5 w-3.5" />
							Download file
						</button>
					</div>
				</Show>

				<Show when={state() === "ready"}>
					{/* Archive file list */}
					<Show
						when={
							props.mimeType === "application/zip" &&
							extractedFiles().length > 0
						}
					>
						<div class="flex h-full flex-col overflow-auto">
							<div class="divide-y divide-border">
								<For each={extractedFiles()}>
									{(file) => (
										<div class="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-secondary/30">
											<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/50">
												<FileText class="h-4 w-4 text-muted-foreground" />
											</div>
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-medium text-foreground">
													{file.name}
												</p>
												<p class="text-xs text-muted-foreground">
													{formatFileSize(file.data.byteLength)}
												</p>
											</div>
											<div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
												<button
													onClick={() => handleDownload(file)}
													class="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
												>
													<Eye class="h-4 w-4" />
												</button>
												<button
													onClick={() => handleDownload(file)}
													class="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
												>
													<Download class="h-4 w-4" />
												</button>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>

					{/* Image preview */}
					<Show
						when={
							inferCategory(props.mimeType) === "image" &&
							!extractedFiles().length
						}
					>
						<div class="flex h-full items-center justify-center bg-secondary/20 p-4">
							<img
								src={src()}
								alt={props.fileName}
								class="max-h-full max-w-full rounded-lg object-contain shadow-sm"
							/>
						</div>
					</Show>

					{/* PDF preview */}
					<Show
						when={
							props.mimeType === "application/pdf" &&
							!extractedFiles().length
						}
					>
						<iframe
							src={src()}
							title={props.fileName}
							class="h-full w-full border-0"
						/>
					</Show>

					{/* Video preview */}
					<Show
						when={
							inferCategory(props.mimeType) === "video" &&
							!extractedFiles().length
						}
					>
						<MseVideoPlayer
							fileId={props.fileId}
							mimeType={props.mimeType}
							chunkSize={props.chunkSize}
							totalChunks={props.totalChunks}
							key={props.key}
							ivBase={props.ivBase}
							fileName={props.fileName}
						/>
					</Show>

					{/* Text / JSON preview */}
					<Show when={text() !== ""}>
						<pre class="h-full overflow-auto bg-secondary/10 p-5 font-mono text-sm leading-relaxed text-foreground">
							{text()}
						</pre>
					</Show>
				</Show>
			</div>
		</div>
	);
}
