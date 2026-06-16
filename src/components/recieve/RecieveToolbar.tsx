import { Search, SlidersHorizontal } from "lucide-solid";
import { Grid, List } from "lucide-solid";
import type { Component } from "solid-js";
import { ToggleGroup } from "@ark-ui/solid/toggle-group";
import { Select, createListCollection } from "@ark-ui/solid/select";
import { ChevronsUpDownIcon } from "lucide-solid";
import { Index, Portal } from "solid-js/web";
import { IconSpan } from "./IconSpan";

interface RecieveToolbarProps {
	searchTerm: string;
	setSearchTerm: (value: string) => void;
	viewMode: "list" | "grid";
	setViewMode: (mode: "list" | "grid") => void;
	sortBy: string;
	setSortBy: (field: string) => void;
}

const sortCollection = createListCollection({
	items: [
		{ label: "Name", value: "name" },
		{ label: "Type", value: "type" },
		{ label: "Size", value: "size" },
		{ label: "Date", value: "date" },
	],
});

export const RecieveToolbar: Component<RecieveToolbarProps> = (props) => {
	return (
		<div class="mb-4 flex flex-wrap items-center gap-3">
			<div class="relative flex-1 min-w-[200px]">
				<IconSpan
					icon={Search}
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<input
					type="text"
					placeholder="Search files..."
					value={props.searchTerm}
					onInput={(e) => props.setSearchTerm(e.currentTarget.value)}
					class="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>

			<ToggleGroup.Root
				defaultValue={[props.viewMode]}
				onValueChange={(details) => {
					if (details.value[0]) {
						props.setViewMode(details.value[0] as "list" | "grid");
					}
				}}
				class="flex items-center gap-0.5 rounded-lg border border-border bg-card p-1"
			>
				<ToggleGroup.Item
					value="list"
					class="flex items-center justify-center rounded-md p-1.5 transition-colors data-[state=on]:bg-primary data-[state=on]:text-primary-foreground text-muted-foreground hover:bg-secondary hover:text-foreground"
					aria-label="List view"
				>
					<IconSpan icon={List} class="h-4 w-4" />
				</ToggleGroup.Item>
				<ToggleGroup.Item
					value="grid"
					class="flex items-center justify-center rounded-md p-1.5 transition-colors data-[state=on]:bg-primary data-[state=on]:text-primary-foreground text-muted-foreground hover:bg-secondary hover:text-foreground"
					aria-label="Grid view"
				>
					<IconSpan icon={Grid} class="h-4 w-4" />
				</ToggleGroup.Item>
			</ToggleGroup.Root>

			<Select.Root
				collection={sortCollection}
				value={[props.sortBy]}
				onValueChange={(details) => props.setSortBy(details.value[0])}
			>
				<Select.Control class="relative">
					<Select.Trigger class="flex items-center gap-2 appearance-none rounded-lg border border-border bg-card py-2 pl-9 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
						<IconSpan
							icon={SlidersHorizontal}
							class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Select.ValueText placeholder="Sort by" />
					</Select.Trigger>
					<div class="absolute right-2 top-1/2 flex -translate-y-1/2 items-center pointer-events-none">
						<Select.Indicator class="text-muted-foreground">
							<ChevronsUpDownIcon class="h-3.5 w-3.5" />
						</Select.Indicator>
					</div>
				</Select.Control>
				<Portal>
					<Select.Positioner>
						<Select.Content class="z-50 min-w-[120px] rounded-lg border border-border bg-card p-1 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
							<Index each={sortCollection.items}>
								{(item) => (
									<Select.Item
										class="flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-sm text-foreground outline-none hover:bg-secondary data-[highlighted]:bg-secondary data-[state=checked]:text-primary"
										item={item()}
									>
										<Select.ItemText>{item().label}</Select.ItemText>
										<Select.ItemIndicator class="text-primary">
											✓
										</Select.ItemIndicator>
									</Select.Item>
								)}
							</Index>
						</Select.Content>
					</Select.Positioner>
				</Portal>
				<Select.HiddenSelect />
			</Select.Root>
		</div>
	);
};
