import { Menu } from "@ark-ui/solid/menu";
import { useNavigate } from "@solidjs/router";
import { ChevronDown, Settings, User } from "lucide-solid";
import { type Component, createSignal, onMount, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";

const PORTFOLIO_API_BASE = "https://portfolio.digitalcovet.com/api/public/file";

function getAvatarUrl(imageKey: string | null): string | null {
  if (!imageKey) return null;
  return `${PORTFOLIO_API_BASE}?key=${encodeURIComponent(imageKey)}`;
}

export const AccountMenu: Component = () => {
  const navigate = useNavigate();
  const [user, setUser] = createSignal<{
    name: string;
    email: string;
    image: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  onMount(async () => {
    try {
      const session = await authClient.getSession();
      if (session.data?.user) {
        setUser({
          name: session.data.user.name,
          email: session.data.user.email,
          image: session.data.user.image ?? null,
        });
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
    } finally {
      setIsLoading(false);
    }
  });

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate("/auth/login");
  };

  const menuItems = [
    { label: "View profile", icon: User, value: "profile" },
    { label: "Account", icon: Settings, value: "account" },
  ];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Show when={!isLoading()} fallback={<div class="h-10" />}>
      <Show when={user()}>
        <Menu.Root positioning={{ placement: "top-start" }}>
          <Menu.Trigger class="w-full flex items-center justify-between gap-3 px-3 py-2 lg:px-4 rounded-lg outline outline-border hover:bg-background/5">
            <span class="flex items-center gap-3">
              <Show
                when={user()?.image != null}
                fallback={
                  <div class="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                    {getInitials(user()?.name ?? "")}
                  </div>
                }
              >
                <img
                  src={getAvatarUrl(user()?.image ?? null) ?? ""}
                  alt="Avatar"
                  class="size-8 rounded-full"
                />
              </Show>
              <span class="text-left">
                <span class="block text-sm font-medium text-foreground">
                  {user()?.name}
                </span>
                <span class="block text-xs text-muted-foreground">
                  {user()?.email}
                </span>
              </span>
            </span>
            <ChevronDown class="size-4 text-muted-foreground" />
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content class="z-50 rounded-xl bg-background shadow-xl outline outline-border overflow-hidden min-w-[calc(var(--reference-width)-1rem)]">
              <div class="p-2 text-sm">
                {menuItems.map((item) => (
                  <Menu.Item
                    value={item.value}
                    class="flex items-center justify-between h-9 px-2 rounded-md text-muted-foreground hover:bg-background/5"
                  >
                    <span class="flex items-center gap-2">
                      <item.icon class="size-4" />
                      {item.label}
                    </span>
                  </Menu.Item>
                ))}
              </div>
              <Menu.Separator class="border-t border-border" />
              <div class="p-2">
                <Menu.Item
                  value="sign-out"
                  onSelect={handleSignOut}
                  class="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md text-muted-foreground bg-muted outline outline-border hover:opacity-90 focus-visible:outline-border h-7 px-3 text-xs w-full"
                >
                  Sign out
                </Menu.Item>
              </div>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </Show>
    </Show>
  );
};
