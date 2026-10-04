import type { InboundTransfer } from "@/types/recieve";

const LOAD_ERROR = "Could not load inbound transfers.";

async function readJson<T>(res: Response): Promise<T | null> {
	const isJson = res.headers.get("Content-Type")?.includes("application/json");
	return isJson ? ((await res.json().catch(() => null)) as T | null) : null;
}

export async function fetchInbound(): Promise<InboundTransfer[]> {
	const res = await fetch("/api/shared/inbound", {
		headers: { Accept: "application/json" },
		cache: "no-store",
	});
	const body = await readJson<{ transfers?: InboundTransfer[]; error?: string }>(res);

	if (!res.ok || !body?.transfers) {
		throw new Error(body?.error ?? `${LOAD_ERROR} (status ${res.status})`);
	}
	return body.transfers;
}
