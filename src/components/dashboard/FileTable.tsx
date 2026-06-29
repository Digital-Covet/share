import { Pagination } from "@ark-ui/solid/pagination";
import {
	Calendar,
	ChevronLeft,
	ChevronRight,
	FileText,
	FolderArchive,
	Image as ImageIcon,
	Info,
	Link as LinkIcon,
	Table as TableIcon,
	Trash2,
} from "lucide-solid";
import { For, Show } from "solid-js";
import type { FileItem } from "@/types/dashboard";
import { Badge } from "../ui/badge";
import { TableCell, TableContainer, TableHeader, TableRow } from "./Table";

interface FileTableProps {
	files: FileItem[];
	onCopyLink: (file: FileItem) => void;
	onEditExpiry: (file: FileItem) => void;
	onDelete: (file: FileItem) => void;
}

export function FileTable(props: FileTableProps) {
	const itemsPerPage = 5;

	const getFileInfo = (type: string) => {
		switch (type) {
			case "pdf":
				return { icon: FileText, colorClass: "bg-error/10 text-error" };
			case "zip":
				return {
					icon: FolderArchive,
					colorClass: "bg-tertiary/10 text-tertiary",
				};
			case "document":
				return { icon: FileText, colorClass: "bg-primary/10 text-primary" };
			case "image":
				return {
					icon: ImageIcon,
					colorClass: "bg-outline-variant/30 text-outline",
				};
			case "spreadsheet":
				return {
					icon: TableIcon,
					colorClass: "bg-emerald-500/10 text-emerald-600",
				};
			default:
				return { icon: FileText, colorClass: "bg-muted text-muted-foreground" };
		}
	};

	const formatDownloads = (file: FileItem) => {
		if (file.status === "Pending" && file.downloads === 0) {
			return "--";
		}
		return file.downloads.toString();
	};

	return (
		<div class="flex flex-col gap-4">
			<Pagination.Root count={props.files.length} pageSize={itemsPerPage}>
				<Pagination.Context>
					{(pagination) => (
						<TableContainer>
							{/* Header — col-spans must sum to 12 */}
							{/* File Name:4  Size:1  Status:2  Expiry:2  Downloads:1  Actions:2 = 12 */}
							<TableHeader>
								<div class="md:col-span-4">File Name</div>
								<div class="md:col-span-1">Size</div>
								<div class="md:col-span-2">Status</div>
								<div class="md:col-span-2">Expiry Date</div>
								<div class="md:col-span-1 text-center">Downloads</div>
								<div class="md:col-span-2 text-right">Actions</div>
							</TableHeader>

							{/* Empty state */}
							<Show when={props.files.length === 0}>
								<div class="flex flex-col items-center justify-center py-16 px-4 text-center">
									<div class="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-3">
										<Info size={24} />
									</div>
									<h3 class="text-base font-semibold font-heading text-on-surface mb-1">
										No files found
									</h3>
									<p class="text-sm text-on-surface-variant max-w-sm">
										We couldn't find any secure transfers matching your current
										search or filter query.
									</p>
								</div>
							</Show>

							{/* Rows */}
							<div class="divide-y divide-outline-variant/30" role="rowgroup">
								<For each={props.files.slice((pagination().page - 1) * itemsPerPage, pagination().page * itemsPerPage)}>
									{(file) => {
										const fileInfo = getFileInfo(file.type);
										const Icon = fileInfo.icon;
										const isExpired = file.status === "Expired";
										return (
											<TableRow isExpired={isExpired}>
												{/* File Name — col-span 4 */}
												<TableCell colSpan={4} class="gap-3">
													<div
														class={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${fileInfo.colorClass}`}
													>
														<Icon size={16} />
													</div>
													<div class="flex flex-col min-w-0">
														<span
															class="font-medium text-on-surface truncate font-sans block text-sm"
															title={file.name}
														>
															{file.name}
														</span>
														{/* Mobile-only inline meta */}
														<div class="flex md:hidden gap-2 items-center mt-1 flex-wrap">
															<span class="text-xs text-on-surface-variant">
																{file.sizeFormatted}
															</span>
															<span class="text-xs text-on-surface-variant/40">
																•
															</span>
															<Badge
																status={file.status}
																class="scale-90 origin-left"
															/>
														</div>
													</div>
												</TableCell>

												{/* Size — col-span 1 (was 2; freed 1 col for Actions) */}
												<TableCell colSpan={1} class="hidden md:flex">
													<span class="font-sans text-on-surface-variant">
														{file.sizeFormatted}
													</span>
												</TableCell>

												{/* Status — col-span 2 */}
												<TableCell colSpan={2} class="hidden md:flex">
													<Badge status={file.status} />
												</TableCell>

												{/* Expiry Date — col-span 2 */}
												<TableCell colSpan={2} class="flex md:col-span-2">
													<div class="flex flex-col md:block">
														<span class="md:hidden text-[10px] text-on-surface-variant/60 uppercase tracking-wider font-semibold">
															Expiry Date
														</span>
														<span
															class={`font-sans ${isExpired ? "text-error font-medium" : "text-on-surface-variant"}`}
														>
															{file.expiryDisplay}
														</span>
													</div>
												</TableCell>

												{/* Downloads — col-span 1 */}
												<TableCell
													colSpan={1}
													class="flex md:col-span-1 md:justify-center"
												>
													<div class="flex flex-col md:block items-center">
														<span class="md:hidden text-[10px] text-on-surface-variant/60 uppercase tracking-wider font-semibold">
															Downloads
														</span>
														<span class="font-sans text-on-surface-variant mt-0.5 md:mt-0">
															{formatDownloads(file)}
														</span>
													</div>
												</TableCell>

												{/* Actions — col-span 2 (was 1; now wide enough for 3 icon buttons) */}
												<TableCell
													colSpan={2}
													align="right"
													class="pt-3 md:pt-0 border-t border-outline-variant/20 md:border-t-0 mt-3 md:mt-0 w-full md:w-auto"
												>
													<div class="flex items-center justify-end gap-1">
														<button
															onClick={() => props.onCopyLink(file)}
															class="text-on-surface-variant hover:text-primary transition-colors p-2 hover:bg-secondary rounded"
															title="Copy Link"
															aria-label={`Copy link for ${file.name}`}
														>
															<LinkIcon size={16} />
														</button>
														<button
															onClick={() => props.onEditExpiry(file)}
															class="text-on-surface-variant hover:text-primary transition-colors p-2 hover:bg-secondary rounded"
															title="Edit Expiry"
															aria-label={`Edit expiry for ${file.name}`}
														>
															<Calendar size={16} />
														</button>
														<button
															onClick={() => props.onDelete(file)}
															class="text-on-surface-variant hover:text-error transition-colors p-2 hover:bg-secondary rounded"
															title="Revoke/Delete"
															aria-label={`Delete ${file.name}`}
														>
															<Trash2 size={16} />
														</button>
													</div>
												</TableCell>
											</TableRow>
										);
									}}
								</For>
							</div>

							{/* Pagination footer */}
							<div class="p-4 border-t border-outline-variant/50 flex flex-col sm:flex-row items-center justify-between bg-surface-container-lowest gap-3">
								<span class="font-sans text-xs text-on-surface-variant">
									{props.files.length === 0
										? "No entries"
										: `Showing ${(pagination().page - 1) * itemsPerPage + 1} to ${Math.min(pagination().page * itemsPerPage, props.files.length)} of ${props.files.length} entries`}
								</span>
								<div class="flex items-center gap-1">
									<Pagination.PrevTrigger class="inline-flex items-center justify-center min-w-9 h-9 px-2 text-xs font-medium rounded-md border border-outline-variant hover:border-outline text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:pointer-events-none">
										<ChevronLeft size={14} />
									</Pagination.PrevTrigger>
									<For each={pagination().pages}>
										{(page, index) =>
											page.type === "page" ? (
												<Pagination.Item
													{...page}
													class="inline-flex items-center justify-center min-w-9 h-9 px-2 text-xs font-medium rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors data-selected:bg-primary data-selected:border-primary data-selected:text-primary-foreground"
												>
													{page.value}
												</Pagination.Item>
											) : (
												<Pagination.Ellipsis
													index={index()}
													class="inline-flex items-center justify-center min-w-9 h-9 text-xs text-on-surface-variant"
												>
													&#8230;
												</Pagination.Ellipsis>
											)
										}
									</For>
									<Pagination.NextTrigger class="inline-flex items-center justify-center min-w-9 h-9 px-2 text-xs font-medium rounded-md border border-outline-variant hover:border-outline text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:pointer-events-none">
										<ChevronRight size={14} />
									</Pagination.NextTrigger>
								</div>
							</div>
						</TableContainer>
					)}
				</Pagination.Context>
			</Pagination.Root>
		</div>
	);
}
