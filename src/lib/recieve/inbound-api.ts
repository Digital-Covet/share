import type { InboundTransfer } from "@/types/recieve";

export async function fetchInbound(): Promise<InboundTransfer[]> {
	const res = await fetch("/api/shared/inbound");
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error ?? "Could not load inbound transfers.");
	}
	const { transfers } = (await res.json()) as { transfers: InboundTransfer[] };
	return transfers;
}
