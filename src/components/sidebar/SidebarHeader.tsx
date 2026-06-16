import { X } from "lucide-solid";
import type { Component } from "solid-js";
import LogoComponent from "~/assets/logo";

interface SidebarHeaderProps {
	onClose: () => void;
}

export const SidebarHeader: Component<SidebarHeaderProps> = (props) => (
	<div class="shrink-0 flex items-center justify-between px-4 lg:px-5 border-b border-border pt-10 py-2">
		<div class="flex items-center gap-2">
			<LogoComponent class="h-6 w-auto" />
		</div>
		<button
			type="button"
			onClick={props.onClose}
			class="lg:hidden p-2 rounded-md outline outline-border text-foreground"
			aria-label="Close navigation"
		>
			<X class="size-4" />
		</button>
	</div>
);
