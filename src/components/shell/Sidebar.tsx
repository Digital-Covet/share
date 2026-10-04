import { A } from "@solidjs/router";
import {
	CloudUpload,
	HardDrive,
	Inbox,
	Lock,
	ShieldAlert,
} from "lucide-solid";
import { For } from "solid-js";
import { Dynamic } from "solid-js/web";
import { ROUTES } from "@/lib/constants";
import { UserMenu } from "./UserMenu";

export const NAV_ITEMS = [
	{ label: "Upload Files", href: ROUTES.UPLOAD, icon: CloudUpload },
	{ label: "Active Shares", href: ROUTES.DASHBOARD, icon: HardDrive },
	{ label: "Inbound Vault", href: ROUTES.RECIEVE, icon: Inbox },
] as const;

const NAV_LINK =
	"flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm font-medium text-text-muted transition-colors duration-(--duration-fast) hover:bg-border-subtle hover:text-text-main focus-visible:outline-2 focus-visible:outline-accent";

export function Sidebar() {
	return (
		<aside class="hidden w-65 shrink-0 flex-col border-r border-border bg-surface-subtle md:flex">
			<div class="flex h-16 items-center px-5">
				<span class="font-display text-xl font-extrabold tracking-[-0.02em] text-primary">
					SEND
				</span>
			</div>

			<div class="px-4">
				<A
					href={ROUTES.UPLOAD}
					class="flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					<ShieldAlert class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
					Encrypt &amp; Send
				</A>
			</div>

			<nav class="mt-6 flex flex-1 flex-col gap-1 px-4" aria-label="Workspaces">
				<p class="px-3 pb-1 text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
					Workspaces
				</p>
				<For each={NAV_ITEMS}>
					{(item) => (
						<A
							href={item.href}
							class={NAV_LINK}
							activeClass="bg-border-subtle !text-text-main"
							end
						>
							<Dynamic component={item.icon} class="size-[22px]" stroke-width={1.75} aria-hidden="true" />
							{item.label}
						</A>
					)}
				</For>

				<p class="mt-6 px-3 pb-1 text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
					System Integrity
				</p>
				<p class="flex items-center gap-2 px-3 text-sm text-text-main">
					<Lock class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
					Zero-Knowledge Active
					<span class="size-2 rounded-full bg-status-success" aria-hidden="true" />
				</p>
			</nav>

			<div class="border-t border-border p-4">
				<UserMenu />
			</div>
		</aside>
	);
}
