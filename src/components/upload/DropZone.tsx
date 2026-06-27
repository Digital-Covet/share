import { FileUpload } from "@ark-ui/solid/file-upload";
import {
	File as FileIcon,
	Lock,
	Upload,
	X,
} from "lucide-solid";
import { type Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import type { FileMetadata } from "@/types/upload";
import { formatFileSize } from "@/utils/upload";

interface DropZoneProps {
	onFilesSelect: (files: File[]) => void;
	selectedFiles: FileMetadata[];
	onRemoveFile: (index: number) => void;
	onReset: () => void;
	disabled?: boolean;
}

const DropZone: Component<DropZoneProps> = (props) => {
	const [isDragOver, setIsDragOver] = createSignal(false);

	const handleFileAccept = (details: { files: File[] }) => {
		if (details.files.length > 0) {
			props.onFilesSelect(details.files);
		}
	};

	const handlePaste = (e: ClipboardEvent) => {
		if (props.disabled) return;
		const items = e.clipboardData?.items;
		if (!items) return;

		const files: File[] = [];
		for (const item of items) {
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (file) files.push(file);
			}
		}
		if (files.length > 0) {
			props.onFilesSelect(files);
		}
	};

	const handleDragOver = (e: DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = () => {
		setIsDragOver(false);
	};

	onMount(() => {
		if (isServer) return;
		document.addEventListener("paste", handlePaste);
	});

	onCleanup(() => {
		if (isServer) return;
		document.removeEventListener("paste", handlePaste);
	});

	const hasFiles = () => props.selectedFiles.length > 0;

	return (
		<FileUpload.Root
			maxFiles={Infinity}
			disabled={props.disabled}
			onFileAccept={handleFileAccept}
		>
			<FileUpload.Dropzone
				class={`relative h-80 rounded-xl border-2 border-dashed bg-card
				transition-all duration-300 group cursor-pointer overflow-hidden
				${isDragOver() ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary hover:bg-accent/30"}
				`}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
			>
				<Show when={hasFiles()} fallback={<DropZoneEmpty />}>
					<DropZoneSelected
						files={props.selectedFiles}
						onRemoveFile={props.onRemoveFile}
						onReset={props.onReset}
					/>
				</Show>
			</FileUpload.Dropzone>
			<FileUpload.HiddenInput />
		</FileUpload.Root>
	);
};

const DropZoneEmpty: Component = () => (
	<div class="flex flex-col items-center justify-center h-full relative z-10 p-6">
		<div
			class="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6
             group-hover:scale-110 group-hover:bg-primary/10 transition-all
             shadow-lg border border-border"
		>
			<Upload class="w-10 h-10 text-primary" stroke-width={1.5} />
		</div>
		<h3 class="font-heading text-xl text-foreground mb-2 text-center">
			Drop files here or click to browse
		</h3>
		<p class="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
			Supports all file types up to 9.9GB. <br />
			You can also paste files from your clipboard (Ctrl+V / Cmd+V).
		</p>
	</div>
);

interface DropZoneSelectedProps {
	files: FileMetadata[];
	onRemoveFile: (index: number) => void;
	onReset: () => void;
}

const DropZoneSelected: Component<DropZoneSelectedProps> = (props) => (
	<div class="absolute inset-0 bg-card/95 backdrop-blur-sm flex flex-col p-6 z-20">
		<div class="flex justify-between items-center mb-4 border-b border-border pb-4">
			<h4 class="text-sm font-semibold uppercase tracking-wider text-foreground">
				Selected Files ({props.files.length})
			</h4>
			<button
				type="button"
				class="text-muted-foreground hover:text-destructive transition-colors
               p-1 hover:bg-destructive/10 rounded"
				onClick={(e) => {
					e.stopPropagation();
					props.onReset();
				}}
				aria-label="Remove all files"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<div class="flex-1 overflow-y-auto space-y-2">
			{props.files.map((file, index) => (
				<div class="flex items-center gap-4 bg-muted p-3 rounded-lg border border-border">
					<FileIcon class="w-6 h-6 text-primary shrink-0" />
					<div class="flex-1 min-w-0">
						<p class="text-sm font-medium text-foreground truncate">
							{file.name}
						</p>
						<p class="text-xs text-muted-foreground mt-0.5">
							{formatFileSize(file.size)}
						</p>
					</div>
					<Lock class="w-4 h-4 text-muted-foreground shrink-0" />
					<button
						type="button"
						class="text-muted-foreground hover:text-destructive transition-colors
                         p-1 hover:bg-destructive/10 rounded"
						onClick={(e) => {
							e.stopPropagation();
							props.onRemoveFile(index);
						}}
						aria-label={`Remove ${file.name}`}
					>
						<X class="w-4 h-4" />
					</button>
				</div>
			))}
		</div>
	</div>
);

export default DropZone;
