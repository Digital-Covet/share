import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { InboundTransfer, InboundView } from "@/types/recieve";
import { applyInboundView } from "./filters";
import { fetchInbound } from "./inbound-api";

const CLOCK_TICK_MS = 30_000;

export function useInboundVault() {
	const [transfers, setTransfers] = createSignal<InboundTransfer[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal<string | null>(null);
	const [view, setView] = createSignal<InboundView>({ query: "", tab: "unopened" });
	const [now, setNow] = createSignal(Date.now());

	onMount(() => {
		fetchInbound()
			.then(setTransfers)
			.catch((err: unknown) =>
				setError(err instanceof Error ? err.message : "Something went wrong."),
			)
			.finally(() => setLoading(false));

		const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
		onCleanup(() => clearInterval(clock));
	});

	return {
		loading,
		error,
		now,
		view,
		setView,
		visible: createMemo(() => applyInboundView(transfers(), view())),
	};
}
