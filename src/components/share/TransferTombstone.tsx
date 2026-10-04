import { A } from "@solidjs/router";
import { AlertOctagon, ArrowRight, ExternalLink } from "lucide-solid";
import { OUTLINE_BUTTON, PRIMARY_BUTTON } from "@/components/ui/button-styles";
import type { UnavailableReason } from "@/types/share";

const WHITEPAPER_URL = "https://digitalcovet.com/security-whitepaper";

const GONE_COPY = {
	heading: "Transfer Expired or Revoked",
	description:
		"The cryptographic payload for this link has reached its expiration threshold or was permanently destroyed by the sender. In accordance with zero-knowledge protocol, no backup copies exist.",
};

const COPY: Record<UnavailableReason, { heading: string; description: string; status: string }> = {
	expired: { ...GONE_COPY, status: "EXPIRED" },
	revoked: { ...GONE_COPY, status: "REVOKED" },
	consumed: { ...GONE_COPY, status: "CONSUMED" },
	not_found: {
		heading: "Transfer Not Found",
		description:
			"No transfer exists for this link. Check that the address is complete, or ask the sender for a new link.",
		status: "NOT FOUND",
	},
};

interface TransferTombstoneProps {
	shareLinkId: string;
	reason: UnavailableReason;
}

export function TransferTombstone(props: TransferTombstoneProps) {
	const copy = () => COPY[props.reason];

	return (
		<div
			class="vault-notch-frame w-full max-w-lg"
			style={{ "--notch": "14px", "--notch-color": "var(--dc-error)" }}
		>
			<div class="vault-notch relative border border-border bg-surface p-8 text-center">
				<span
					class="vault-notch-tick pointer-events-none absolute top-0 right-0"
					aria-hidden="true"
				/>
				<div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-status-error-tint">
					<AlertOctagon class="size-6 text-status-error" stroke-width={1.75} aria-hidden="true" />
				</div>
				<h1 class="font-display text-xl font-extrabold tracking-[-0.02em] text-text-main">
					{copy().heading}
				</h1>
				<p class="mt-2 mb-6 text-sm text-text-muted">{copy().description}</p>

				<div class="mb-6 rounded-sm border border-border-subtle bg-surface-subtle p-3 text-left font-mono text-xs text-text-muted">
					<p class="break-all">Share ID: {props.shareLinkId}</p>
					<p>Link Status: {copy().status} (HTTP 410 GONE)</p>
				</div>

				<div class="flex flex-col justify-center gap-3 sm:flex-row">
					<a href={WHITEPAPER_URL} class={OUTLINE_BUTTON} rel="noopener noreferrer">
						Learn About Zero-Knowledge
						<ExternalLink class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
					</a>
					<A href="/upload" class={PRIMARY_BUTTON}>
						Send Your Own File
						<ArrowRight class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
					</A>
				</div>
			</div>
		</div>
	);
}
