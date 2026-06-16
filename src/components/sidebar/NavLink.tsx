import { A } from "@solidjs/router";
import * as LucideIcons from "lucide-solid";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";

interface NavLinkProps {
	label: string;
	icon: string;
	href?: string;
	badge?: { value: string | number; variant?: "default" | "destructive" };
	active?: boolean;
	onClick?: () => void;
}

export const NavLink: Component<NavLinkProps> = (props) => {
	const Icon = () => (LucideIcons as any)[props.icon] || LucideIcons.FileText;

	const content = (
		<>
			<span class="flex items-center gap-2">
				<Dynamic component={Icon()} class="size-4" aria-hidden="true" />
				<span>{props.label}</span>
			</span>
			{props.badge && (
				<span
					class={`text-[0.70rem] px-1.5 py-0.5 rounded text-foreground outline outline-border bg-background/10 ${
						props.badge.variant === "destructive" ? "bg-destructive" : ""
					}`}
				>
					{props.badge.value}
				</span>
			)}
		</>
	);

	if (props.href) {
		return (
			<A
				href={props.href}
				class="group flex items-center justify-between h-9 px-3 rounded-md text-sm text-muted-foreground hover:bg-background/5"
				activeClass="bg-background/10 text-foreground outline-border/10"
				inactiveClass="text-muted-foreground"
			>
				{content}
			</A>
		);
	}

	return (
		<button
			type="button"
			onClick={props.onClick}
			class={`w-full h-9 px-3 rounded-md flex items-center justify-between text-sm outline outline-transparent hover:bg-background/5 ${
				props.active
					? "bg-background/10 text-foreground outline-border/10"
					: "text-muted-foreground"
			}`}
		>
			{content}
		</button>
	);
};
