import { ShieldCheck } from "lucide-solid";
import { Show } from "solid-js";
import type { TransferSender } from "@/types/recieve";

function initialsOf(email: string): string {
	return (email.split("@")[0] ?? "").slice(0, 2).toUpperCase();
}

export function SenderInfo(props: { sender: TransferSender }) {
	return (
		<div class="mb-3 flex items-center gap-2">
			<span
				class="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-text-inverse"
				aria-hidden="true"
			>
				{initialsOf(props.sender.email)}
			</span>
			<span class="min-w-0 truncate text-xs font-medium text-text-main">
				{props.sender.email}
			</span>
			<Show when={props.sender.verified}>
				<ShieldCheck
					class="size-3.5 shrink-0 text-status-success"
					stroke-width={1.75}
					aria-label="Verified sender"
					role="img"
				/>
			</Show>
		</div>
	);
}
