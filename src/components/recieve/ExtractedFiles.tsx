import { For, Show } from "solid-js";
import { Check } from "lucide-solid";

import { FILES } from "@/data/recieve";
import { FileListItem } from "./FileListItem";
import { IconSpan } from "./IconSpan";

interface ExtractedFilesProps {
	viewMode: "list" | "grid";
	selected: Set<string>;
	onToggleSelect: (name: string) => void;
	onSelectAll: () => void;
	onClearSelection: () => void;
}

export const ExtractedFiles = (props: ExtractedFilesProps) => {
	const allSelected = () => {
		const names = FILES.map((f) => f.name);
		return names.every((name) => props.selected.has(name));
	};

	const handleToggleAll = () => {
		if (allSelected()) {
			props.onClearSelection();
		} else {
			props.onSelectAll();
		}
	};

	if (props.viewMode === "grid") {
		return (
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				<For each={FILES}>
					{(file) => (
						<FileListItem
							file={file}
							viewMode="grid"
							selected={props.selected.has(file.name)}
							onToggleSelect={props.onToggleSelect}
						/>
					)}
				</For>
			</div>
		);
	}

	return (
		<div class="overflow-hidden rounded-xl border border-border">
			<table class="w-full">
				<thead>
					<tr class="border-b border-border bg-secondary/30">
						<th class="w-10 px-4 py-2.5">
							<button
								onClick={handleToggleAll}
								class={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
									allSelected()
										? "border-primary bg-primary text-primary-foreground"
										: "border-border bg-card text-muted-foreground hover:border-primary/50"
								}`}
							>
								<Show when={allSelected()}>
									<IconSpan icon={Check} class="h-3 w-3" />
								</Show>
							</button>
						</th>
						<th class="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Name
						</th>
						<th class="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Type
						</th>
						<th class="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Size
						</th>
						<th class="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Received
						</th>
						<th class="w-24 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Actions
						</th>
					</tr>
				</thead>
				<tbody>
					<For each={FILES}>
						{(file) => (
							<FileListItem
								file={file}
								viewMode="list"
								selected={props.selected.has(file.name)}
								onToggleSelect={props.onToggleSelect}
							/>
						)}
					</For>
				</tbody>
			</table>
		</div>
	);
};
