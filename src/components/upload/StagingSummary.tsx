import { KeyFingerprint } from "@/components/crypto/KeyFingerprint";
import type { StagingTotals } from "@/lib/upload/staging";
import { formatFileSize } from "@/utils/upload";

interface StagingSummaryProps {
	totals: StagingTotals;
	fingerprint: string | null;
}

function Stat(props: { label: string; value: string }) {
	return (
		<div class="min-w-0">
			<dt class="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
				{props.label}
			</dt>
			<dd class="truncate font-mono text-sm text-text-main">{props.value}</dd>
		</div>
	);
}

export function StagingSummary(props: StagingSummaryProps) {
	return (
		<div class="flex flex-wrap items-end justify-between gap-4 border-t border-border-subtle bg-surface-subtle px-4 py-3">
			<dl class="flex flex-wrap gap-x-8 gap-y-2">
				<Stat label="Files" value={String(props.totals.count)} />
				<Stat label="Total size" value={formatFileSize(props.totals.bytes)} />
				<Stat label="Output" value={props.totals.outputName} />
			</dl>
			<KeyFingerprint digest={props.fingerprint} />
		</div>
	);
}
