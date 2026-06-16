import type { LucideIcon } from "lucide-solid";
import type { Component } from "solid-js";

interface IconSpanProps {
	icon: LucideIcon;
	class?: string;
}

export const IconSpan: Component<IconSpanProps> = (props) => {
	const Icon = props.icon;

	return (
		<span class="shrink-0">
			<Icon class={props.class} />
		</span>
	);
};
