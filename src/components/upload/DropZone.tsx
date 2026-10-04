import { UploadCloud } from "lucide-solid";
import { FilePickerButton } from "./FilePickerButton";

interface DropZoneProps {
	dragging: boolean;
	onFiles: (files: File[]) => void;
}

export function DropZone(props: DropZoneProps) {
	return (
		<div
			class="flex flex-col items-center gap-3 border-2 border-dashed p-12 text-center focus-within:outline-2 focus-within:outline-accent hover:border-primary"
			classList={{
				"border-primary bg-primary-tint": props.dragging,
				"border-border-strong": !props.dragging,
			}}
		>
			<UploadCloud class="size-12 text-primary" stroke-width={1.75} aria-hidden="true" />
			<h2 class="font-display text-xl font-bold text-text-main">Drag files here or browse</h2>
			<p class="max-w-sm text-sm text-text-muted">
				Multiple files are automatically bundled into an encrypted files.zip
			</p>
			<FilePickerButton label="Select from Disk" onFiles={props.onFiles} />
		</div>
	);
}
