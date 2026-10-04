import { ShieldCheck } from "lucide-solid";
import { PRIMARY_BUTTON } from "@/components/ui/button-styles";
import type { AccessSettings } from "@/types/upload";
import { DownloadLimitField } from "./DownloadLimitField";
import { ExpiryField } from "./ExpiryField";
import { PassphraseField } from "./PassphraseField";

interface SecuritySettingsCardProps {
	settings: AccessSettings;
	locked: boolean;
	canSubmit: boolean;
	encrypting: boolean;
	onChange: (next: AccessSettings) => void;
	onSubmit: () => void;
}

export function SecuritySettingsCard(props: SecuritySettingsCardProps) {
	return (
		<section class="rounded-md border border-border bg-surface p-6 shadow-xs">
			<h2 class="font-display text-[25px] leading-tight font-bold tracking-[-0.01em] text-text-main">
				Access Controls
			</h2>
			<div class="mt-4 space-y-4">
				<ExpiryField settings={props.settings} disabled={props.locked} onChange={props.onChange} />
				<DownloadLimitField
					settings={props.settings}
					disabled={props.locked}
					onChange={props.onChange}
				/>
				<PassphraseField
					settings={props.settings}
					disabled={props.locked}
					onChange={props.onChange}
				/>
				<hr class="border-border-subtle" />
				<p class="text-xs text-text-muted">
					<span class="font-medium text-text-main">Zero-Knowledge Guarantee:</span> File contents
					and passwords never touch Digital Covet servers.
				</p>
				<button
					type="button"
					disabled={!props.canSubmit}
					onClick={props.onSubmit}
					class={`${PRIMARY_BUTTON} w-full`}
				>
					<ShieldCheck class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
					{props.encrypting ? "Encrypting…" : "Encrypt & Generate Link"}
				</button>
			</div>
		</section>
	);
}
