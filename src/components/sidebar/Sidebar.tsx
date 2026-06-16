import { Collapsible } from "@ark-ui/solid/collapsible";
import { Menu } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { AccountMenu } from "./AccountMenu";
import { NavLink } from "./NavLink";
import { SidebarHeader } from "./SidebarHeader";

interface SidebarProps {
  onToggle?: () => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  const [open, setOpen] = createSignal(false);

  const toggleOpen = (value: boolean) => {
    setOpen(value);
    props.onToggle?.();
  };

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") toggleOpen(false);
  };

  if (!isServer) {
    onMount(() => {
      document.addEventListener("keydown", handleEscape);
    });
    onCleanup(() => {
      document.removeEventListener("keydown", handleEscape);
    });
  }

  return (
    <Collapsible.Root open={open()} onOpenChange={(e) => toggleOpen(e.open)}>
      <div class="lg:hidden sticky top-0 z-40 bg-background border-b border-border">
        <div class="flex items-center justify-between px-4 h-12">
          <div class="flex items-center gap-2">
            <div class="text-foreground h-6 w-6 bg-foreground/10 rounded" />
            <span class="text-sm font-semibold text-foreground">Oxbow UI</span>
          </div>
          <Collapsible.Trigger
            class="flex items-center justify-center size-7 p-0.5 text-xs rounded-md bg-background outline outline-border hover:bg-muted text-foreground"
            aria-label="Open navigation"
          >
            <Menu class="size-4" />
          </Collapsible.Trigger>
        </div>
      </div>

      <Show when={open()}>
        <div
          class="fixed inset-0 z-40 bg-background/10 lg:hidden"
          onClick={() => toggleOpen(false)}
          aria-hidden="true"
        />
      </Show>

      <aside
        class={`fixed z-50 h-full inset-y-0 left-0 w-60 lg:w-72 lg:static lg:translate-x-0 transform transition-transform duration-200 bg-background outline outline-border flex flex-col ${open() ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
        <SidebarHeader onClose={() => toggleOpen(false)} />

        <nav class="flex-1 px-2 lg:px-3 pt-2 overflow-y-auto">
          <ul class="space-y-1 mb-2">
            <li>
              <NavLink
                label="Dashboard"
                icon="LayoutDashboard"
                href="/dashboard"
              />
            </li>
            <li>
              <NavLink label="Upload" icon="Upload" href="/upload" />
            </li>
            <li>
              <NavLink label="Recieve" icon="Download" href="/recieve" />
            </li>
          </ul>
        </nav>

        <div class="shrink-0 bg-background border-t border-border py-3 lg:px-4 px-3 lg:py-4">
          <AccountMenu />
        </div>
      </aside>
    </Collapsible.Root>
  );
};
