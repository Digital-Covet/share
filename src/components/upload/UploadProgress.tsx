import { Progress } from "@ark-ui/solid/progress";
import { Shield } from "lucide-solid";
import { type Component, Show } from "solid-js";
import { formatFileSize, getPhaseLabel } from "@/utils/upload";

interface UploadProgressProps {
	fileName: string;
	progress: number;
	uploadedSize: number;
	totalSize: number;
	currentFileIndex: number;
	totalFiles: number;
	onCancel: () => void;
}

const UploadProgress: Component<UploadProgressProps> = (props) => (
	<div class="bg-card rounded-xl p-6 border border-border flex flex-col gap-4 shadow-sm">
		<ProgressHeader
			fileName={props.fileName}
			progress={props.progress}
			currentFileIndex={props.currentFileIndex}
			totalFiles={props.totalFiles}
		/>
		<Progress.Root value={props.progress} max={100}>
			<Progress.Track class="w-full h-2 bg-muted rounded-full overflow-hidden">
				<Progress.Range class="h-full bg-primary rounded-full transition-all duration-300 ease-out" />
			</Progress.Track>
		</Progress.Root>
		<ProgressFooter
			uploadedSize={props.uploadedSize}
			totalSize={props.totalSize}
			onCancel={props.onCancel}
		/>
	</div>
);

const ProgressHeader: Component<{
	fileName: string;
	progress: number;
	currentFileIndex: number;
	totalFiles: number;
}> = (props) => (
	<div class="flex justify-between items-start gap-4">
		<div class="flex-1 min-w-0">
			<h4 class="text-sm font-semibold text-foreground flex items-center gap-2">
				<Show when={props.progress > 30}>
					<Shield class="w-4 h-4 text-primary shrink-0" />
				</Show>
				<span>{getPhaseLabel(props.progress)}</span>
				<Show when={props.totalFiles > 1}>
					<span class="text-xs text-muted-foreground font-normal">
						({props.currentFileIndex + 1} of {props.totalFiles})
					</span>
				</Show>
			</h4>
			<p class="text-xs text-muted-foreground mt-1 truncate">
				{props.fileName}
			</p>
		</div>
		<span class="text-sm font-bold text-primary tabular-nums">
			{props.progress}%
		</span>
	</div>
);

interface ProgressFooterProps {
	uploadedSize: number;
	totalSize: number;
	onCancel: () => void;
}

const ProgressFooter: Component<ProgressFooterProps> = (props) => (
	<div class="flex justify-between items-center">
		<p class="text-xs text-muted-foreground font-medium tabular-nums">
			{formatFileSize(props.uploadedSize)} / {formatFileSize(props.totalSize)}
		</p>
		<button
			class="text-xs font-semibold text-destructive hover:text-destructive/80
             transition-colors px-2 py-1 rounded hover:bg-destructive/10"
			onClick={props.onCancel}
		>
			Cancel
		</button>
	</div>
);

export default UploadProgress;
