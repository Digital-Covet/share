import { SegmentGroup } from "@ark-ui/solid/segment-group";
import { For } from "solid-js";

export interface SegmentOption<T extends string> {
	value: T;
	label: string;
}

interface SegmentTabsProps<T extends string> {
	value: T;
	options: ReadonlyArray<SegmentOption<T>>;
	onChange: (next: T) => void;
}

export function SegmentTabs<T extends string>(props: SegmentTabsProps<T>) {
	return (
		<SegmentGroup.Root
			value={props.value}
			onValueChange={(e) => e.value && props.onChange(e.value as T)}
			class="relative inline-flex rounded-md border border-border bg-surface p-0.5"
		>
			<SegmentGroup.Indicator
				class="absolute rounded-sm bg-secondary"
				style={{
					width: "var(--width)",
					height: "var(--height)",
					left: "var(--left)",
					top: "var(--top)",
				}}
			/>
			<For each={props.options}>
				{(option) => (
					<SegmentGroup.Item
						value={option.value}
						class="relative z-10 flex min-h-[40px] cursor-pointer items-center px-3 text-sm font-medium text-text-muted transition-colors duration-(--duration-fast) data-[state=checked]:text-text-inverse"
					>
						<SegmentGroup.ItemText>{option.label}</SegmentGroup.ItemText>
						<SegmentGroup.ItemControl />
						<SegmentGroup.ItemHiddenInput />
					</SegmentGroup.Item>
				)}
			</For>
		</SegmentGroup.Root>
	);
}
