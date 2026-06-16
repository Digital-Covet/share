import type { LucideIcon } from "lucide-solid";
import type { Component } from "solid-js";

interface ActionButtonProps {
	icon: LucideIcon;
	label: string;
	disabled?: boolean;
	loading?: boolean;
	secondary?: boolean;
	onClick?: () => void;
}

export const ActionButton: Component<ActionButtonProps> = (props) => {
	const Icon = props.icon;

	return (
		<button
			disabled={props.disabled}
			onClick={props.onClick}
			class={
				props.secondary
					? "flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
					: "flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80"
			}
		>
			<span class="shrink-0">
				<Icon class={`h-5 w-5 ${props.loading ? "spin-slow" : ""}`} />
			</span>

			{props.label}
		</button>
	);
};
