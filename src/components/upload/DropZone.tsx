import { FileUpload } from "@ark-ui/solid/file-upload";
import { File as FileIcon, Lock, Upload, X } from "lucide-solid";
import { type Component, onCleanup, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import type { FileMetadata } from "@/types/upload";
import { formatFileSize } from "@/utils/upload";

interface DropZoneProps {
	onFileSelect: (file: File) => void;
	selectedFile: FileMetadata | null;
	onReset: () => void;
	disabled?: boolean;
}

const DropZone: Component<DropZoneProps> = (props) => {
	const handleFileAccept = (details: { files: File[] }) => {
		if (details.files.length > 0) {
			props.onFileSelect(details.files[0]);
		}
	};

	const handlePaste = (e: ClipboardEvent) => {
		if (props.disabled) return;
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (file) {
					props.onFileSelect(file);
					break;
				}
			}
		}
	};

	onMount(() => {
		if (isServer) return;
		document.addEventListener("paste", handlePaste);
	});

	onCleanup(() => {
		if (isServer) return;
		document.removeEventListener("paste", handlePaste);
	});

	return (
		<FileUpload.Root
			maxFiles={1}
			disabled={props.disabled}
			onFileAccept={handleFileAccept}
		>
			<FileUpload.Dropzone
				class="relative h-80 rounded-xl border-2 border-dashed border-border bg-card
               transition-all duration-300 hover:border-primary hover:bg-accent/30
               group cursor-pointer overflow-hidden"
			>
				<Show when={props.selectedFile} fallback={<DropZoneEmpty />}>
					<DropZoneSelected
						file={props.selectedFile!}
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
			Supports all file types up to 50GB. <br />
			You can also paste a file from your clipboard (Ctrl+V / Cmd+V). <br />
			Files are zero-knowledge encrypted locally before transfer.
		</p>
	</div>
);

interface DropZoneSelectedProps {
	file: FileMetadata;
	onReset: () => void;
}

const DropZoneSelected: Component<DropZoneSelectedProps> = (props) => (
	<div class="absolute inset-0 bg-card/95 backdrop-blur-sm flex flex-col p-6 z-20">
		<div class="flex justify-between items-center mb-4 border-b border-border pb-4">
			<h4 class="text-sm font-semibold uppercase tracking-wider text-foreground">
				Selected Files (1)
			</h4>
			<button
				class="text-muted-foreground hover:text-destructive transition-colors
               p-1 hover:bg-destructive/10 rounded"
				onClick={(e) => {
					e.stopPropagation();
					props.onReset();
				}}
				aria-label="Remove selected file"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<div class="flex items-center gap-4 bg-muted p-4 rounded-lg border border-border">
			<FileIcon class="w-8 h-8 text-primary shrink-0" />
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium text-foreground truncate">
					{props.file.name}
				</p>
				<p class="text-xs text-muted-foreground mt-1">
					{formatFileSize(props.file.size)}
				</p>
			</div>
			<Lock class="w-4 h-4 text-muted-foreground shrink-0" />
		</div>
	</div>
);

export default DropZone;
