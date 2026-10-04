import { HardDrive } from "lucide-solid";
import { For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
	formatRemaining,
	isExpiringSoon,
	isTtlLow,
	remainingRatio,
} from "@/lib/dashboard/ttl";
import { FILE_TYPE_ICON, STATUS_PRESENTATION } from "@/lib/dashboard/status";
import type { FileItem } from "@/types/dashboard";
import { type FileActionHandlers, FileActions } from "./FileActions";
import { StatusBadge } from "./StatusBadge";
import { TtlDecayRule } from "./TtlDecayRule";

const HEADERS = ["File Name", "Size", "Status", "Downloads", "Remaining TTL"] as const;

interface FileTableProps extends FileActionHandlers {
	files: FileItem[];
	loading: boolean;
	now: number;
	onCreateTransfer: () => void;
}

function rowClass(file: FileItem): string {
	return STATUS_PRESENTATION[file.status].filter === "revoked" ? "opacity-60" : "";
}

function downloadsLabel(file: FileItem): string {
	return file.maxDownloads === null
		? `${file.downloads} downloads`
		: `${file.downloads} / ${file.maxDownloads} downloads`;
}

function FileName(props: { file: FileItem }) {
	return (
		<span class="flex min-w-0 items-center gap-3">
			<Dynamic
				component={FILE_TYPE_ICON[props.file.type]}
				class="size-[18px] shrink-0 text-text-muted"
				stroke-width={1.75}
				aria-hidden="true"
			/>
			<span class="truncate font-display font-semibold text-text-main">
				{props.file.name}
			</span>
		</span>
	);
}

function RemainingTtl(props: { file: FileItem; now: number }) {
	const soon = () => isExpiringSoon(props.file, props.now);

	return (
		<div class="min-w-28">
			<span
				class="font-mono text-xs text-text-main"
				classList={{ "ttl-pulse text-status-warning": soon() }}
			>
				{formatRemaining(props.file, props.now)}
			</span>
			<TtlDecayRule
				ratio={remainingRatio(props.file, props.now)}
				low={isTtlLow(props.file, props.now)}
			/>
		</div>
	);
}

function EmptyState(props: { onCreateTransfer: () => void }) {
	return (
		<div class="flex flex-col items-center gap-3 px-4 py-16 text-center">
			<HardDrive class="size-10 text-text-muted" stroke-width={1.75} aria-hidden="true" />
			<p class="font-display text-xl font-semibold text-text-main">
				No files currently shared
			</p>
			<button
				type="button"
				onClick={props.onCreateTransfer}
				class="min-h-[44px] cursor-pointer rounded-md bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
			>
				Create Transfer
			</button>
		</div>
	);
}

export function FileTable(props: FileTableProps) {
	return (
		<div class="overflow-hidden rounded-md border border-border bg-surface">
			<Show
				when={props.files.length > 0}
				fallback={
					props.loading ? (
						<p class="px-4 py-16 text-center font-mono text-xs text-text-muted">
							Loading vault files…
						</p>
					) : (
						<EmptyState onCreateTransfer={props.onCreateTransfer} />
					)
				}
			>
				<table class="hidden w-full border-collapse text-left md:table">
					<thead class="border-b border-border bg-surface-subtle">
						<tr>
							<For each={HEADERS}>
								{(header) => (
									<th
										scope="col"
										class="px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-text-muted"
									>
										{header}
									</th>
								)}
							</For>
							<th scope="col" class="px-4 py-3 text-right">
								<span class="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border-subtle">
						<For each={props.files}>
							{(file) => (
								<tr class={`h-12 hover:bg-surface-subtle/50 ${rowClass(file)}`}>
									<td class="max-w-72 px-4 py-2 text-sm">
										<FileName file={file} />
									</td>
									<td class="px-4 py-2 font-mono text-xs text-text-main">
										{file.sizeFormatted}
									</td>
									<td class="px-4 py-2">
										<StatusBadge status={file.status} />
									</td>
									<td class="px-4 py-2 font-mono text-xs text-text-main">
										{downloadsLabel(file)}
									</td>
									<td class="px-4 py-2">
										<RemainingTtl file={file} now={props.now} />
									</td>
									<td class="px-4 py-2">
										<div class="flex justify-end">
											<FileActions
												file={file}
												onCopy={props.onCopy}
												onSaveExpiry={props.onSaveExpiry}
												onRevoke={props.onRevoke}
											/>
										</div>
									</td>
								</tr>
							)}
						</For>
					</tbody>
				</table>

				<ul class="divide-y divide-border-subtle md:hidden">
					<For each={props.files}>
						{(file) => (
							<li class={`flex items-center justify-between gap-3 p-4 ${rowClass(file)}`}>
								<div class="min-w-0 space-y-1.5">
									<FileName file={file} />
									<StatusBadge status={file.status} />
								</div>
								<FileActions
									file={file}
									onCopy={props.onCopy}
									onSaveExpiry={props.onSaveExpiry}
									onRevoke={props.onRevoke}
								/>
							</li>
						)}
					</For>
				</ul>
			</Show>
		</div>
	);
}
