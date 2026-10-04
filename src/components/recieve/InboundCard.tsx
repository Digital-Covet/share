import { A } from "@solidjs/router";
import { Unlock } from "lucide-solid";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { KeyFingerprint } from "@/components/crypto/KeyFingerprint";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PRIMARY_BUTTON } from "@/components/ui/button-styles";
import { VaultNotchCard } from "@/components/ui/VaultNotchCard";
import { formatRemaining } from "@/lib/dashboard/ttl";
import { FILE_TYPE_ICON, STATUS_PRESENTATION } from "@/lib/dashboard/status";
import type { InboundTransfer } from "@/types/recieve";
import { SenderInfo } from "./SenderInfo";

const READY_LABEL = "READY FOR DECRYPTION";

interface InboundCardProps {
	transfer: InboundTransfer;
	now: number;
}

function expiryText(transfer: InboundTransfer, now: number): string {
	return transfer.expiryTimestamp > 0
		? `Expiring in ${formatRemaining(transfer, now)}`
		: "No expiry";
}

export function InboundCard(props: InboundCardProps) {
	const live = () => STATUS_PRESENTATION[props.transfer.status].live;

	return (
		<VaultNotchCard
			notch={10}
			class="rounded-md p-5 transition-colors duration-(--duration-fast) hover:border-primary"
		>
			<Show when={props.transfer.sender}>{(sender) => <SenderInfo sender={sender()} />}</Show>

			<div class="flex items-start gap-3">
				<Dynamic
					component={FILE_TYPE_ICON[props.transfer.type]}
					class="mt-0.5 size-[18px] shrink-0 text-text-muted"
					stroke-width={1.75}
					aria-hidden="true"
				/>
				<div class="min-w-0">
					<h2 class="truncate font-display text-base font-bold text-text-main">
						{props.transfer.name}
					</h2>
					<p class="mt-1 font-mono text-xs text-text-muted">
						{props.transfer.sizeFormatted} · {expiryText(props.transfer, props.now)}
					</p>
				</div>
			</div>

			<Show when={props.transfer.fingerprint}>
				{(digest) => (
					<div class="mt-3">
						<KeyFingerprint digest={digest()} label="ECDH" />
					</div>
				)}
			</Show>

			<div class="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
				<StatusBadge
					status={props.transfer.status}
					label={live() ? READY_LABEL : undefined}
				/>
				<Show when={live()}>
					<A href={`/s/${props.transfer.shareLinkId}`} class={PRIMARY_BUTTON}>
						<Unlock class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
						Decrypt &amp; Open
					</A>
				</Show>
			</div>
		</VaultNotchCard>
	);
}
