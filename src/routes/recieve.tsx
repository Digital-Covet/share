import { DownloadTrigger } from "@ark-ui/solid/download-trigger";
import { Title } from "@solidjs/meta";
import {
	Download,
	LoaderCircle,
	X,
} from "lucide-solid";
import {
	createMemo,
	createResource,
	createSignal,
	Show,
} from "solid-js";
import { isServer } from "solid-js/web";
import { ActionButton } from "@/components/recieve/ActionButton";
import { ExtractedFiles } from "@/components/recieve/ExtractedFiles";
import { FileInfoPanel } from "@/components/recieve/FileInfoPanel";
import { IconSpan } from "@/components/recieve/IconSpan";
import { RecieveHeader } from "@/components/recieve/RecieveHeader";
import { RecieveToolbar } from "@/components/recieve/RecieveToolbar";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { apiUrl } from "@/lib/api/url";
import type { FileItem } from "@/types/recieve";
import AuthGuard from "@/components/auth/auth-guard";

async function fetchSharedFiles(): Promise<FileItem[]> {
	if (isServer) return [];
	const res = await fetch(apiUrl("/api/shared"), { credentials: "include" });
	if (!res.ok) throw new Error("Failed to load shared files");
	const data = await res.json();
	return data.files as FileItem[];
}

export default function Recieve() {
	const [files, setFiles] = createSignal<FileItem[]>([]);
	const [remoteFiles, { refetch }] = createResource(fetchSharedFiles);
	const isLoading = () => remoteFiles.loading && !remoteFiles();

	const [searchTerm, setSearchTerm] = createSignal("");
	const [viewMode, setViewMode] = createSignal<"list" | "grid">("list");
	const [sortBy, setSortBy] = createSignal("name");
	const [selected, setSelected] = createSignal(new Set<string>());

	const toggleSelect = (name: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(name)) {
				next.delete(name);
			} else {
				next.add(name);
			}
			return next;
		});
	};

	const selectAll = () => {
		setSelected(new Set(files().map((f) => f.name)));
	};

	const clearSelection = () => {
		setSelected(new Set<string>());
	};

	const filteredFiles = createMemo(() => {
		const search = searchTerm().toLowerCase().trim();
		let result = [...files()];

		if (search) {
			result = result.filter(
				(file) =>
					file.name.toLowerCase().includes(search) ||
					file.type.toLowerCase().includes(search),
			);
		}

		const field = sortBy();
		result.sort((a, b) => {
			if (field === "name") return a.name.localeCompare(b.name);
			if (field === "type") return a.type.localeCompare(b.type);
			if (field === "size") return a.sizeBytes - b.sizeBytes;
			if (field === "date") return a.receivedDate.localeCompare(b.receivedDate);
			return 0;
		});

		return result;
	});

	const selectionCount = () => selected().size;

	const totalSize = createMemo(() => {
		const bytes = files().reduce((sum, f) => sum + f.sizeBytes, 0);
		if (bytes === 0) return "0 B";
		const units = ["B", "KB", "MB", "GB", "TB"];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		const size = bytes / 1024 ** i;
		return `${size < 10 ? size.toFixed(size < 1 ? 2 : 1) : Math.round(size)} ${units[i]}`;
	});

	return (
		<AuthGuard>
			<>
				<Title>Shared Files</Title>
				<div class="flex h-screen">
					<Sidebar />
					<main class="flex-1 overflow-auto">
						<div class="mx-auto w-full max-w-6xl p-6 md:p-10">
							<Show
								when={!isLoading()}
								fallback={
									<div class="flex items-center justify-center py-16 gap-2 text-on-surface-variant">
										<LoaderCircle size={18} class="animate-spin" />
										<span class="text-sm">Loading shared files...</span>
									</div>
								}
							>
								<Show
									when={files().length > 0}
									fallback={
										<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16">
											<p class="text-sm text-muted-foreground">
												No shared files yet.
											</p>
										</div>
									}
								>
									<FileInfoPanel
										fileCount={filteredFiles().length}
										totalSize={totalSize()}
									/>

									<RecieveHeader fileCount={filteredFiles().length} />

									<RecieveToolbar
										searchTerm={searchTerm()}
										setSearchTerm={setSearchTerm}
										viewMode={viewMode()}
										setViewMode={setViewMode}
										sortBy={sortBy()}
										setSortBy={setSortBy}
									/>

									<Show
										when={filteredFiles().length > 0}
										fallback={
											<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16">
												<p class="text-sm text-muted-foreground">
													No files match your search.
												</p>
											</div>
										}
									>
										<ExtractedFiles
											files={filteredFiles()}
											viewMode={viewMode()}
											selected={selected()}
											onToggleSelect={toggleSelect}
											onSelectAll={selectAll}
											onClearSelection={clearSelection}
										/>
									</Show>

									<Show when={selectionCount() > 0}>
										<div class="mt-4 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
											<span class="text-sm font-medium text-foreground">
												{selectionCount()} file{selectionCount() !== 1 ? "s" : ""}{" "}
												selected
											</span>
											<div class="flex items-center gap-2">
												<button
													onClick={clearSelection}
													class="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
												>
													<IconSpan icon={X} class="h-3.5 w-3.5" />
													Clear
												</button>
												<DownloadTrigger
													data={() =>
														`Selected files: ${Array.from(selected()).join(", ")}`
													}
													fileName="selected-files.txt"
													mimeType="text/plain"
													class="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 active:scale-[0.98]"
												>
													<IconSpan icon={Download} class="h-3.5 w-3.5" />
													Download Selected
												</DownloadTrigger>
											</div>
										</div>
									</Show>

									<div class="mt-6">
										<DownloadTrigger
											data={() =>
												`Shared files: ${files().map((f) => f.name).join(", ")}`
											}
											fileName="all-shared-files.txt"
											mimeType="text/plain"
											class="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
										>
											<IconSpan icon={Download} class="h-5 w-5" />
											Download All Files
										</DownloadTrigger>
									</div>
								</Show>
							</Show>
						</div>
					</main>
				</div>
			</>
		</AuthGuard>
	);
}
