import { For } from "solid-js";
import type { DashboardStats } from "@/types/dashboard";

interface StatStripProps {
	stats: DashboardStats;
}

function formatStorage(gb: number): string {
	return gb < 1 ? `${Math.round(gb * 1024)} MB` : `${gb.toFixed(1)} GB`;
}

export function StatStrip(props: StatStripProps) {
	const entries = () => [
		{ label: "Active Files", value: String(props.stats.activeLinks) },
		{ label: "Storage Used", value: formatStorage(props.stats.storageUsedGB) },
		{ label: "Total Downloads", value: String(props.stats.totalDownloads) },
	];

	return (
		<dl class="mt-4 flex flex-wrap gap-x-8 gap-y-2">
			<For each={entries()}>
				{(entry) => (
					<div class="flex items-baseline gap-2">
						<dd class="font-mono text-[13px] font-medium text-text-main">
							{entry.value}
						</dd>
						<dt class="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
							{entry.label}
						</dt>
					</div>
				)}
			</For>
		</dl>
	);
}
