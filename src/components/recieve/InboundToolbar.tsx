import { SearchField } from "@/components/ui/SearchField";
import { type SegmentOption, SegmentTabs } from "@/components/ui/SegmentTabs";
import type { InboundTab, InboundView } from "@/types/recieve";

const TABS: ReadonlyArray<SegmentOption<InboundTab>> = [
	{ value: "unopened", label: "Unopened" },
	{ value: "all", label: "All Inbound" },
	{ value: "saved", label: "Saved" },
];

interface InboundToolbarProps {
	view: InboundView;
	onChange: (next: InboundView) => void;
}

export function InboundToolbar(props: InboundToolbarProps) {
	return (
		<div class="flex flex-col gap-3 py-2 lg:flex-row lg:items-center lg:justify-between">
			<SearchField
				value={props.view.query}
				label="Search transfers"
				placeholder="Search by sender or file name..."
				onInput={(query) => props.onChange({ ...props.view, query })}
			/>
			<SegmentTabs
				value={props.view.tab}
				options={TABS}
				onChange={(tab) => props.onChange({ ...props.view, tab })}
			/>
		</div>
	);
}
