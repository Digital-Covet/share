import { CheckCircle2, Copy, Key } from "lucide-solid";
import { Show } from "solid-js";
import { OUTLINE_BUTTON } from "@/components/ui/button-styles";
import type { UploadReceipt } from "@/types/upload";

interface ShareLinkReceiptCardProps {
	receipt: UploadReceipt;
	onCopy: (text: string, label: string) => void;
	onReset: () => void;
}

export function ShareLinkReceiptCard(props: ShareLinkReceiptCardProps) {
	return (
		<section class="rounded-md border border-status-success bg-surface p-6">
			<h2 class="flex items-center gap-2 font-display text-xl font-semibold text-text-main">
				<CheckCircle2 class="size-[22px] text-status-success" stroke-width={1.75} aria-hidden="true" />
				Share link ready
			</h2>
			<label class="mt-4 block">
				<span class="sr-only">Share URL</span>
				<input
					readonly
					value={props.receipt.shareUrl}
					onFocus={(e) => e.currentTarget.select()}
					class="min-h-[44px] w-full rounded-md border border-border bg-surface-subtle px-3 font-mono text-xs text-text-main focus-visible:outline-2 focus-visible:outline-accent"
				/>
			</label>
			<div class="mt-3 flex flex-col gap-2 sm:flex-row">
				<button
					type="button"
					class={`${OUTLINE_BUTTON} flex-1`}
					onClick={() => props.onCopy(props.receipt.shareUrl, "Share link")}
				>
					<Copy class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
					Copy Share URL
				</button>
				<Show when={props.receipt.password}>
					{(password) => (
						<button
							type="button"
							class={`${OUTLINE_BUTTON} flex-1`}
							onClick={() => props.onCopy(password(), "Passphrase")}
						>
							<Key class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
							Copy Password
						</button>
					)}
				</Show>
			</div>
			<button
				type="button"
				onClick={props.onReset}
				class="mt-3 min-h-[44px] w-full cursor-pointer text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
			>
				Send another transfer
			</button>
		</section>
	);
}
