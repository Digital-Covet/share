import { STATUS_PRESENTATION } from "@/lib/dashboard/status";
import type { InboundTab, InboundTransfer, InboundView } from "@/types/recieve";

// No per-recipient "opened" flag exists, so a download count stands in for it.
const TAB_PREDICATES: Record<InboundTab, (t: InboundTransfer) => boolean> = {
	unopened: (t) => STATUS_PRESENTATION[t.status].live && t.downloads === 0,
	all: () => true,
	saved: (t) => t.downloads > 0,
};

function matchesQuery(transfer: InboundTransfer, query: string): boolean {
	if (!query) return true;
	const needle = query.toLowerCase();
	return (
		transfer.name.toLowerCase().includes(needle) ||
		(transfer.sender?.email.toLowerCase().includes(needle) ?? false)
	);
}

export function applyInboundView(
	transfers: InboundTransfer[],
	{ query, tab }: InboundView,
): InboundTransfer[] {
	return transfers
		.filter((t) => TAB_PREDICATES[tab](t) && matchesQuery(t, query.trim()))
		.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
}
