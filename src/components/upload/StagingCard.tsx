import { createSignal, For, Show } from "solid-js";
import { VaultNotchCard } from "@/components/ui/VaultNotchCard";
import type { StagingTotals } from "@/lib/upload/staging";
import type { StagedFile } from "@/types/upload";
import { DropZone } from "./DropZone";
import { FilePickerButton } from "./FilePickerButton";
import { StagedFileRow } from "./StagedFileRow";
import { StagingSummary } from "./StagingSummary";

interface StagingCardProps {
	files: StagedFile[];
	totals: StagingTotals;
	fingerprint: string | null;
	locked: boolean;
	onFiles: (files: File[]) => void;
	onRemove: (id: string) => void;
}

export function StagingCard(props: StagingCardProps) {
	const [dragging, setDragging] = createSignal(false);

	return (
		<VaultNotchCard
			onDragOver={(e) => {
				e.preventDefault();
				if (!props.locked) setDragging(true);
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={(e) => {
				e.preventDefault();
				setDragging(false);
				props.onFiles(Array.from(e.dataTransfer?.files ?? []));
			}}
		>
			<Show
				when={props.files.length > 0}
				fallback={<DropZone dragging={dragging()} onFiles={props.onFiles} />}
			>
				<div class="flex items-center justify-between px-4 py-3 pr-10">
					<h2 class="font-display text-xl font-semibold text-text-main">Staged files</h2>
					<FilePickerButton
						label="Add files"
						disabled={props.locked}
						onFiles={props.onFiles}
					/>
				</div>
				<ul class="divide-y divide-border-subtle border-t border-border-subtle">
					<For each={props.files}>
						{(entry) => (
							<StagedFileRow entry={entry} locked={props.locked} onRemove={props.onRemove} />
						)}
					</For>
				</ul>
				<StagingSummary totals={props.totals} fingerprint={props.fingerprint} />
			</Show>
		</VaultNotchCard>
	);
}
