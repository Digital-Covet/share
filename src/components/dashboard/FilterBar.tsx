import { Menu } from "@ark-ui/solid/menu";
import { ArrowDownUp } from "lucide-solid";
import { For } from "solid-js";
import { Portal } from "solid-js/web";
import { SearchField } from "@/components/ui/SearchField";
import { type SegmentOption, SegmentTabs } from "@/components/ui/SegmentTabs";
import {
	type FileViewOptions,
	SORT_OPTIONS,
	type SortKey,
} from "@/lib/dashboard/filters";
import type { StatusFilter } from "@/lib/dashboard/status";

const STATUS_SEGMENTS: ReadonlyArray<SegmentOption<StatusFilter>> = [
	{ value: "all", label: "All" },
	{ value: "active", label: "Active" },
	{ value: "consumed", label: "Consumed" },
	{ value: "expired", label: "Expired" },
	{ value: "revoked", label: "Revoked" },
];

interface FilterBarProps {
	view: FileViewOptions;
	onChange: (next: FileViewOptions) => void;
}

export function FilterBar(props: FilterBarProps) {
	const sortLabel = () =>
		SORT_OPTIONS.find((o) => o.value === props.view.sort)?.label;

	return (
		<div class="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
			<SearchField
				value={props.view.query}
				label="Filter files"
				placeholder="Filter by file name, share ID, or hash..."
				onInput={(query) => props.onChange({ ...props.view, query })}
			/>

			<div class="flex flex-wrap items-center gap-3">
				<SegmentTabs
					value={props.view.status}
					options={STATUS_SEGMENTS}
					onChange={(status) => props.onChange({ ...props.view, status })}
				/>

				<Menu.Root
					onSelect={(e) =>
						props.onChange({ ...props.view, sort: e.value as SortKey })
					}
				>
					<Menu.Trigger class="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-main hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent">
						<ArrowDownUp class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
						Sort: {sortLabel()}
					</Menu.Trigger>
					<Portal>
						<Menu.Positioner>
							<Menu.Content class="z-50 min-w-40 rounded-md border border-border-strong bg-surface p-1 shadow-[0_10px_25px_-5px_var(--dc-shadow)]">
								<For each={SORT_OPTIONS}>
									{(option) => (
										<Menu.Item
											value={option.value}
											class="cursor-pointer rounded-sm px-3 py-2 text-sm text-text-main data-highlighted:bg-surface-subtle"
										>
											{option.label}
										</Menu.Item>
									)}
								</For>
							</Menu.Content>
						</Menu.Positioner>
					</Portal>
				</Menu.Root>
			</div>
		</div>
	);
}
