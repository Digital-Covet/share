import { Meta, Title } from "@solidjs/meta";
import { For, Show } from "solid-js";
import { InboundCard } from "@/components/recieve/InboundCard";
import { InboundEmptyState } from "@/components/recieve/InboundEmptyState";
import { InboundToolbar } from "@/components/recieve/InboundToolbar";
import { AppShell } from "@/components/shell/AppShell";
import { useInboundVault } from "@/lib/recieve/use-inbound-vault";
import { pageMetadata } from "@/lib/seo";

export default function Recieve() {
	const vault = useInboundVault();

	return (
		<>
			<Title>{pageMetadata.receive.title}</Title>
			<Meta name="description" content={pageMetadata.receive.description} />
			<AppShell>
				<header>
					<h1 class="font-display text-[31px] leading-tight font-extrabold tracking-[-0.02em] text-text-main">
						Inbound Vault
					</h1>
					<p class="mt-1 text-text-muted">
						Transfers shared directly with your verified identity.
					</p>
				</header>

				<InboundToolbar view={vault.view()} onChange={vault.setView} />

				<Show when={vault.error()}>
					{(message) => (
						<p role="alert" class="mt-4 text-sm text-status-error">
							{message()}
						</p>
					)}
				</Show>

				<div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					<Show
						when={vault.visible().length > 0}
						fallback={
							vault.loading() ? (
								<p class="col-span-full py-16 text-center font-mono text-xs text-text-muted">
									Loading inbound transfers…
								</p>
							) : (
								<InboundEmptyState />
							)
						}
					>
						<For each={vault.visible()}>
							{(transfer) => <InboundCard transfer={transfer} now={vault.now()} />}
						</For>
					</Show>
				</div>
			</AppShell>
		</>
	);
}
