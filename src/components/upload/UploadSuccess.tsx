import { CircleCheck, Copy, Info, Key, Plus } from "lucide-solid";
import { type Component, createSignal, Show } from "solid-js";
import type { ShareData } from "@/types/upload";

interface UploadSuccessProps {
	shareData: ShareData;
	onNewUpload: () => void;
	onViewDetails?: () => void;
}

const UploadSuccess: Component<UploadSuccessProps> = (props) => (
	<div
		class="bg-card rounded-xl p-8 border border-secondary/30
           relative overflow-hidden shadow-sm"
	>
		{/* Left accent bar */}
		<div class="absolute top-0 left-0 w-1 h-full bg-primary" />

		<div class="flex flex-col sm:flex-row items-start gap-6">
			<SuccessIcon />

			<div class="flex-1 min-w-0 w-full">
				<h3 class="font-heading text-xl text-foreground mb-2">
					Upload Complete &amp; Secured
				</h3>
				<p class="text-sm text-muted-foreground mb-6 leading-relaxed">
					File has been encrypted and stored in the secure vault. Share the link
					and key below.
				</p>

				<ShareLinkBox shareData={props.shareData} />

				<div class="flex justify-between items-center mt-3">
					<span class="text-xs text-primary flex items-center gap-1.5 font-medium">
						<Info class="w-3.5 h-3.5" />
						End-to-end decryption key included in URL
					</span>
				</div>
			</div>
		</div>

		<SuccessActions
			onNewUpload={props.onNewUpload}
			onViewDetails={props.onViewDetails}
		/>
	</div>
);

// ---- Internal sub-views ----

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
}

const ShareLinkBox: Component<ShareLinkBoxProps> = (props) => {
	const [copied, setCopied] = createSignal(false);

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(
				`${props.shareData.url}#key=${props.shareData.key}`,
			);
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
			<span class="text-foreground font-mono">{props.shareData.url}</span>

			<span
				class="text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20
               inline-flex items-center gap-1.5 text-xs font-mono whitespace-nowrap w-fit"
				title="End-to-end decryption key"
			>
				#key={props.shareData.key}
				<Key class="w-3 h-3" />
			</span>

			<button
				class="sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2
               text-muted-foreground hover:text-primary transition-all
               bg-card p-1.5 rounded border border-border hover:border-primary
               flex items-center gap-1.5 ml-auto sm:ml-0 shadow-sm"
				onClick={copyLink}
				title="Copy full link to clipboard"
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
	onViewDetails?: () => void;
}

const SuccessActions: Component<SuccessActionsProps> = (props) => (
	<div class="mt-8 flex flex-wrap gap-3 border-t border-border/50 pt-6">
		<button
			class="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold
             hover:bg-primary/90 transition-colors flex items-center gap-2
             shadow-sm hover:shadow-md active:scale-95 transform duration-150"
			onClick={props.onNewUpload}
		>
			<Plus class="w-4 h-4" />
			New Upload
		</button>
		<button
			class="border border-border text-foreground px-6 py-2.5 rounded-lg text-sm font-medium
             hover:bg-muted transition-colors bg-card"
			onClick={props.onViewDetails}
		>
			View File Details
		</button>
	</div>
);

export default UploadSuccess;
