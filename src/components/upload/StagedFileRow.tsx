import { Trash2 } from "lucide-solid";
import { Dynamic } from "solid-js/web";
import { formatFileSize } from "@/utils/upload";
import type { StagedFile } from "@/types/upload";
import { fileIconFor } from "./file-icon";

interface StagedFileRowProps {
	entry: StagedFile;
	locked: boolean;
	onRemove: (id: string) => void;
}

export function StagedFileRow(props: StagedFileRowProps) {
	return (
		<li class="flex min-h-12 items-center gap-3 px-4">
			<Dynamic
				component={fileIconFor(props.entry.file)}
				class="size-[18px] shrink-0 text-text-muted"
				stroke-width={1.75}
				aria-hidden="true"
			/>
			<span class="min-w-0 flex-1 truncate font-display font-semibold text-text-main">
				{props.entry.file.name}
			</span>
			<span class="font-mono text-xs text-text-muted tabular-nums">
				{formatFileSize(props.entry.file.size)}
			</span>
			<button
				type="button"
				disabled={props.locked}
				onClick={() => props.onRemove(props.entry.id)}
				aria-label={`Remove ${props.entry.file.name}`}
				class="flex size-11 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle hover:text-status-error focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
			>
				<Trash2 class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
			</button>
		</li>
	);
}
