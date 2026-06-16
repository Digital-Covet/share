import { Download, Eye, Check } from "lucide-solid";
import type { Component } from "solid-js";
import { Show } from "solid-js";
import { DownloadTrigger } from "@ark-ui/solid/download-trigger";

import type { FileItem } from "@/types/recieve";
import { IconSpan } from "./IconSpan";

interface FileListItemProps {
	file: FileItem;
	viewMode: "list" | "grid";
	selected: boolean;
	onToggleSelect: (name: string) => void;
}

export const FileListItem: Component<FileListItemProps> = (props) => {
	const Icon = props.file.icon;

	if (props.viewMode === "grid") {
		return (
			<div
				class={`group relative flex flex-col items-center rounded-xl border bg-card p-4 transition-colors hover:shadow-md ${
					props.selected
						? "border-primary/50 bg-primary/5"
						: "border-border hover:border-primary/50"
				}`}
			>
				<button
					onClick={() => props.onToggleSelect(props.file.name)}
					class={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border transition-colors ${
						props.selected
							? "border-primary bg-primary text-primary-foreground"
							: "border-border bg-card text-transparent opacity-0 group-hover:opacity-100"
					}`}
				>
					<Show when={props.selected}>
						<IconSpan icon={Check} class="h-3 w-3" />
					</Show>
				</button>

				<div class="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-secondary/50">
					<Icon class={`h-7 w-7 ${props.file.iconClass}`} />
				</div>

				<span class="mb-1 w-full truncate text-center text-sm font-medium text-foreground">
					{props.file.name}
				</span>

				<span class="mb-3 text-xs text-muted-foreground">
					{props.file.size}
				</span>

				<div class="flex w-full items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
					<button class="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary">
						<IconSpan icon={Eye} class="h-4 w-4" />
					</button>
					<DownloadTrigger
						data={() => `File: ${props.file.name} (${props.file.size})`}
						fileName={props.file.name}
						mimeType="application/octet-stream"
						class="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
					>
						<IconSpan icon={Download} class="h-4 w-4" />
					</DownloadTrigger>
				</div>
			</div>
		);
	}

	return (
		<tr
			class={`group border-b border-border transition-colors hover:bg-secondary/30 ${
				props.selected ? "bg-primary/5" : ""
			}`}
		>
			<td class="w-10 px-4 py-3">
				<button
					onClick={() => props.onToggleSelect(props.file.name)}
					class={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
						props.selected
							? "border-primary bg-primary text-primary-foreground"
							: "border-border bg-card text-transparent hover:border-primary/50"
					}`}
				>
					<Show when={props.selected}>
						<IconSpan icon={Check} class="h-3 w-3" />
					</Show>
				</button>
			</td>
			<td class="px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50">
						<Icon class={`h-4 w-4 ${props.file.iconClass}`} />
					</div>
					<span class="text-sm font-medium text-foreground">
						{props.file.name}
					</span>
				</div>
			</td>
			<td class="px-4 py-3">
				<span class="text-sm text-muted-foreground">{props.file.type}</span>
			</td>
			<td class="px-4 py-3">
				<span class="text-sm text-muted-foreground">{props.file.size}</span>
			</td>
			<td class="px-4 py-3">
				<span class="text-sm text-muted-foreground">
					{props.file.receivedDate}
				</span>
			</td>
			<td class="w-24 px-4 py-3">
				<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
					<button class="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary">
						<IconSpan icon={Eye} class="h-4 w-4" />
					</button>
					<DownloadTrigger
						data={() => `File: ${props.file.name} (${props.file.size})`}
						fileName={props.file.name}
						mimeType="application/octet-stream"
						class="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
					>
						<IconSpan icon={Download} class="h-4 w-4" />
					</DownloadTrigger>
				</div>
			</td>
		</tr>
	);
};
