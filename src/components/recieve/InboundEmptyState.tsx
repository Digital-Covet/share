import { Inbox } from "lucide-solid";

export function InboundEmptyState() {
	return (
		<div class="col-span-full flex flex-col items-center gap-3 rounded-md border border-border bg-surface px-4 py-16 text-center">
			<Inbox class="size-10 text-text-muted" stroke-width={1.75} aria-hidden="true" />
			<p class="font-display text-xl font-semibold text-text-main">
				No incoming transfers waiting for decryption.
			</p>
		</div>
	);
}
