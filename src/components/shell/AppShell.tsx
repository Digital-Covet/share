import { A } from "@solidjs/router";
import { createEffect, For, type ParentProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@/lib/constants";
import { NAV_ITEMS, Sidebar } from "./Sidebar";

function MobileNav() {
	return (
		<header class="flex h-14 items-center justify-between border-b border-border bg-surface-subtle px-4 md:hidden">
			<span class="font-display text-lg font-extrabold tracking-[-0.02em] text-primary">
				SEND
			</span>
			<nav class="flex items-center gap-1" aria-label="Primary">
				<For each={NAV_ITEMS}>
					{(item) => (
						<A
							href={item.href}
							aria-label={item.label}
							end
							class="flex size-11 items-center justify-center rounded-md text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
							activeClass="bg-border-subtle !text-text-main"
						>
							<Dynamic component={item.icon} class="size-[22px]" stroke-width={1.75} aria-hidden="true" />
						</A>
					)}
				</For>
			</nav>
		</header>
	);
}

function redirectToLoginWhenSignedOut() {
	const session = authClient.useSession();

	createEffect(() => {
		const { data, isPending } = session();
		if (isPending || data?.user) return;

		const loginUrl = new URL(ROUTES.LOGIN, window.location.origin);
		loginUrl.searchParams.set("redirect", window.location.href);
		window.location.assign(loginUrl.href);
	});
}

export function AppShell(props: ParentProps) {
	redirectToLoginWhenSignedOut();

	return (
		<div class="flex min-h-screen flex-col bg-background md:flex-row">
			<MobileNav />
			<Sidebar />
			<main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">
				{props.children}
			</main>
		</div>
	);
}
