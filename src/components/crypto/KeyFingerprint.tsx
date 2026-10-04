import { Lock } from "lucide-solid";
import { Show } from "solid-js";

const VISIBLE_CHARS = 4;

interface KeyFingerprintProps {
	digest: string | null;
	label?: string;
}

export function KeyFingerprint(props: KeyFingerprintProps) {
	return (
		<span
			class="inline-flex items-center gap-1.5 rounded-sm bg-surface-subtle px-2 py-1 font-mono text-[11px] text-text-muted"
			aria-hidden="true"
		>
			<Lock class="size-3.5" stroke-width={1.75} />
			<Show when={props.digest} fallback={`${props.label ?? "SHA256"}: awaiting key`}>
				{(digest) => (
					<>
						{props.label ?? "SHA256"}: {digest().slice(0, VISIBLE_CHARS)}…{digest().slice(-VISIBLE_CHARS)}
						<span class="size-1.5 rounded-full bg-status-success" />
					</>
				)}
			</Show>
		</span>
	);
}
