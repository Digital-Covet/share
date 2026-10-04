import { ShieldCheck } from "lucide-solid";
import type { ParentProps } from "solid-js";

export function DownloadVault(props: ParentProps) {
	return (
		<div class="vault-notch-frame w-full max-w-[540px]" style={{ "--notch": "16px" }}>
			<div class="vault-notch relative border border-border bg-surface p-8">
				<span
					class="vault-notch-tick pointer-events-none absolute top-0 right-0"
					aria-hidden="true"
				/>
				<header class="mb-6 flex items-center gap-3">
					<ShieldCheck class="size-8 text-primary" stroke-width={1.75} aria-hidden="true" />
					<div>
						<h1 class="font-display text-xl font-extrabold tracking-[-0.02em] text-text-main">
							Zero-Knowledge Transfer
						</h1>
						<p class="text-xs text-text-muted">Encrypted client-side via AES-256-GCM</p>
					</div>
				</header>
				{props.children}
			</div>
		</div>
	);
}
