import { Key, Lock, ShieldCheck } from "lucide-solid";
import { For } from "solid-js";

const FEATURES = [
	{ Icon: ShieldCheck, label: "Browser-native AES-256-GCM encryption" },
	{ Icon: Key, label: "Direct R2 presigned multipart uploads" },
	{ Icon: Lock, label: "No plaintext files or passwords ever stored" },
] as const;

export function SecurityFeatureList() {
	return (
		<ul class="mb-6 space-y-2 rounded-md bg-surface-subtle p-4 text-xs text-text-muted">
			<For each={FEATURES}>
				{(feature) => (
					<li class="flex items-center gap-2.5">
						<feature.Icon
							class="size-3.5 shrink-0 text-accent"
							stroke-width={1.75}
							aria-hidden="true"
						/>
						<span>{feature.label}</span>
					</li>
				)}
			</For>
		</ul>
	);
}
