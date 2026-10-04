import { Menu } from "@ark-ui/solid/menu";
import { ChevronsUpDown, LogOut } from "lucide-solid";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import { authClient } from "@/lib/auth-client";
import { resolveAvatarUrl } from "@/lib/avatar";
import { ROUTES } from "@/lib/constants";

async function signOut() {
	await fetch("/api/sign-out", { method: "POST" });
	window.location.assign(ROUTES.LOGIN);
}

export function UserMenu() {
	const session = authClient.useSession();
	const user = () => session().data?.user;
	const avatarUrl = () => resolveAvatarUrl(user()?.image);

	return (
		<Menu.Root positioning={{ placement: "top-start" }}>
			<Menu.Trigger class="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left hover:bg-border-subtle focus-visible:outline-2 focus-visible:outline-accent">
				<span class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-medium text-text-inverse">
					<Show when={avatarUrl()} fallback={user()?.name?.charAt(0).toUpperCase() ?? "?"}>
						{(src) => <img src={src()} alt="" class="size-full object-cover" />}
					</Show>
				</span>
				<span class="min-w-0 flex-1 truncate text-sm font-medium text-text-main">
					{user()?.name ?? "Account"}
				</span>
				<ChevronsUpDown class="size-[18px] text-text-muted" stroke-width={1.75} aria-hidden="true" />
			</Menu.Trigger>
			<Portal>
				<Menu.Positioner>
					<Menu.Content class="z-50 min-w-48 rounded-md border border-border-strong bg-surface p-1 shadow-[0_10px_25px_-5px_var(--dc-shadow)]">
						<Menu.Item
							value="sign-out"
							onSelect={signOut}
							class="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm px-3 text-sm text-text-main data-highlighted:bg-surface-subtle"
						>
							<LogOut class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
							Sign out
						</Menu.Item>
					</Menu.Content>
				</Menu.Positioner>
			</Portal>
		</Menu.Root>
	);
}
