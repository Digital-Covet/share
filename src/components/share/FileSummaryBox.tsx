import { AlertTriangle, Clock } from "lucide-solid";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { TtlDecayRule } from "@/components/dashboard/TtlDecayRule";
import { fileIconFor } from "@/components/upload/file-icon";
import { formatRemaining, isTtlLow, remainingRatio } from "@/lib/dashboard/ttl";
import type { ShareTransfer } from "@/types/share";
import { formatFileSize } from "@/utils/upload";

interface FileSummaryBoxProps {
	transfer: ShareTransfer;
	now: number;
}

function downloadsNote(remaining: number): string {
	return remaining === 1 ? "1 download remaining" : `${remaining} downloads remaining`;
}

export function FileSummaryBox(props: FileSummaryBoxProps) {
	const icon = () => fileIconFor({ name: props.transfer.fileName, type: props.transfer.mimeType });
	const ttlWindow = () => ({
		expiryTimestamp: props.transfer.expiresAt ?? 0,
		// The link's creation time isn't exposed publicly; the rule shows time left against a 30-day window.
		createdTimestamp: (props.transfer.expiresAt ?? 0) - 30 * 24 * 60 * 60 * 1000,
	});

	return (
		<section class="mb-6 rounded-md border border-border-subtle bg-surface-subtle p-4">
			<div class="flex items-center justify-between gap-4">
				<div class="flex min-w-0 items-center gap-2">
					<Dynamic
						component={icon()}
						class="size-5 shrink-0 text-primary"
						stroke-width={1.75}
						aria-hidden="true"
					/>
					<h2 class="truncate font-display text-base font-bold text-text-main">
						{props.transfer.fileName}
					</h2>
				</div>
				<div class="shrink-0 text-right font-mono text-xs text-text-muted">
					<div class="text-sm text-text-main">{formatFileSize(props.transfer.sizeBytes)}</div>
					<div>{props.transfer.totalChunks} chunks</div>
				</div>
			</div>

			<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border-subtle pt-2 text-[11px] text-text-muted">
				<Show when={props.transfer.expiresAt}>
					<span class="flex items-center gap-1">
						<Clock class="size-3.5" stroke-width={1.75} aria-hidden="true" />
						Expires in {formatRemaining(ttlWindow(), props.now)}
					</span>
				</Show>
				<Show when={props.transfer.remainingDownloads !== null}>
					<span class="flex items-center gap-1">
						<AlertTriangle class="size-3.5" stroke-width={1.75} aria-hidden="true" />
						{downloadsNote(props.transfer.remainingDownloads ?? 0)}
					</span>
				</Show>
			</div>

			<Show when={props.transfer.expiresAt}>
				<TtlDecayRule
					ratio={remainingRatio(ttlWindow(), props.now)}
					low={isTtlLow(ttlWindow(), props.now)}
				/>
			</Show>
		</section>
	);
}
