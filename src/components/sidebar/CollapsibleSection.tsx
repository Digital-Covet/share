import * as LucideIcons from "lucide-solid";
import { ChevronDown, ChevronRight } from "lucide-solid";
import type { Component, JSX } from "solid-js";
import { createSignal, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

interface CollapsibleSectionProps {
	label: string;
	icon: string;
	children: JSX.Element;
	defaultOpen?: boolean;
}

export const CollapsibleSection: Component<CollapsibleSectionProps> = (
	props,
) => {
	const [open, setOpen] = createSignal(props.defaultOpen ?? true);
	const Icon = () => (LucideIcons as any)[props.icon] || LucideIcons.Folder;

	return (
		<li class="pt-2 mt-2 border-t border-border">
			<button
				type="button"
				onClick={() => setOpen(!open())}
				aria-expanded={open()}
				class="w-full h-9 px-3 rounded-md flex items-center justify-between text-sm text-muted-foreground hover:bg-background/5"
			>
				<span class="flex items-center gap-2">
					<Dynamic component={Icon()} class="size-4" aria-hidden="true" />
					<span>{props.label}</span>
				</span>
				<span class="text-muted-foreground">
					<Show when={open()} fallback={<ChevronRight class="size-4" />}>
						<ChevronDown class="size-4" />
					</Show>
				</span>
			</button>

			<Show when={open()}>
				<ul class="mt-1 pl-2 space-y-1">{props.children}</ul>
			</Show>
		</li>
	);
};
