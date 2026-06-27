import { CircleCheck, Copy, Plus } from "lucide-solid";
import { type Component, createSignal, For, Show } from "solid-js";
import type { FileMetadata, ShareData } from "@/types/upload";

interface UploadSuccessProps {
	shareDataList: ShareData[];
	uploadedFiles: FileMetadata[];
	onNewUpload: () => void;
}

const UploadSuccess: Component<UploadSuccessProps> = (props) => (
	<div
		class="bg-card rounded-xl p-8 border border-secondary/30
           relative overflow-hidden shadow-sm"
	>
		<div class="absolute top-0 left-0 w-1 h-full bg-primary" />

		<div class="flex flex-col sm:flex-row items-start gap-6">
			<SuccessIcon />

			<div class="flex-1 min-w-0 w-full">
				<h3 class="font-heading text-xl text-foreground mb-2">
					Upload Complete
				</h3>
				<p class="text-sm text-muted-foreground mb-6 leading-relaxed">
					{props.uploadedFiles.length === 1
						? "File has been encrypted and stored. Share the link below."
						: `${props.uploadedFiles.length} files have been encrypted and stored. Share the links below.`}
				</p>

				<div class="space-y-3">
					<For each={props.shareDataList}>
						{(data, index) => (
							<ShareLinkBox shareData={data} fileName={props.uploadedFiles[index()]?.name} />
						)}
					</For>
				</div>
			</div>
		</div>

		<SuccessActions onNewUpload={props.onNewUpload} />
	</div>
);

const SuccessIcon: Component = () => (
	<div
		class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center
           shrink-0 border border-primary/20"
	>
		<CircleCheck class="w-6 h-6 text-primary" />
	</div>
);

interface ShareLinkBoxProps {
	shareData: ShareData;
	fileName?: string;
}

const ShareLinkBox: Component<ShareLinkBoxProps> = (props) => {
	const [copied, setCopied] = createSignal(false);

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(props.shareData.url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy to clipboard:", err);
		}
	};

	return (
		<div
			class="bg-muted rounded-lg border border-border p-4 text-sm break-all
             relative group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
		>
			<div class="flex-1 min-w-0">
				<Show when={props.fileName}>
					<p class="text-xs font-medium text-foreground truncate mb-1">
						{props.fileName}
					</p>
				</Show>
				<span class="text-foreground font-mono">{props.shareData.url}</span>
			</div>

			<button
				type="button"
				class="sm:shrink-0
               text-muted-foreground hover:text-primary transition-all
               bg-card p-1.5 rounded border border-border hover:border-primary
               flex items-center gap-1.5 shadow-sm"
				onClick={copyLink}
				title="Copy link to clipboard"
				aria-label="Copy share link"
			>
				<Show when={copied()} fallback={<Copy class="w-4 h-4" />}>
					<span class="text-xs font-bold text-primary px-1">Copied!</span>
				</Show>
			</button>
		</div>
	);
};

interface SuccessActionsProps {
	onNewUpload: () => void;
}

const SuccessActions: Component<SuccessActionsProps> = (props) => (
	<div class="mt-8 flex flex-wrap gap-3 border-t border-border/50 pt-6">
		<button
			type="button"
			class="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold
             hover:bg-primary/90 transition-colors flex items-center gap-2
             shadow-sm hover:shadow-md active:scale-95 transform duration-150"
			onClick={props.onNewUpload}
		>
			<Plus class="w-4 h-4" />
			New Upload
		</button>
	</div>
);

export default UploadSuccess;
