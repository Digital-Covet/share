import { DownloadTrigger } from "@ark-ui/solid/download-trigger";
import { Title } from "@solidjs/meta";
import {
	Download,
	LoaderCircle,
	ShieldCheck,
	TriangleAlert,
	X,
} from "lucide-solid";
import { createMemo, createSignal, Show } from "solid-js";
import { ActionButton } from "@/components/recieve/ActionButton";
import { ExtractedFiles } from "@/components/recieve/ExtractedFiles";
import { FileInfoPanel } from "@/components/recieve/FileInfoPanel";
import { IconSpan } from "@/components/recieve/IconSpan";
import { RecieveHeader } from "@/components/recieve/RecieveHeader";
import { RecieveToolbar } from "@/components/recieve/RecieveToolbar";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { FILES } from "@/data/recieve";
import AuthGuard from "@/components/auth/auth-guard";

type ViewerState = "ready" | "decrypting" | "extracted";

export default function Recieve() {
	const [state, setState] = createSignal<ViewerState>("ready");
	const [searchTerm, setSearchTerm] = createSignal("");
	const [viewMode, setViewMode] = createSignal<"list" | "grid">("list");
	const [sortBy, setSortBy] = createSignal("name");
	const [selected, setSelected] = createSignal(new Set<string>());

	const handleUnlock = () => {
		setState("decrypting");
		setTimeout(() => {
			setState("extracted");
		}, 2000);
	};

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
		setSelected(new Set(FILES.map((f) => f.name)));
	};

	const clearSelection = () => {
		setSelected(new Set<string>());
	};

	const filteredFiles = createMemo(() => {
		const search = searchTerm().toLowerCase().trim();
		let result = [...FILES];

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
			if (field === "size") return a.size.localeCompare(b.size);
			if (field === "date") return a.receivedDate.localeCompare(b.receivedDate);
			return 0;
		});

		return result;
	});

	const selectionCount = () => selected().size;

	return (
		<AuthGuard>
			<>
				<Title>Received Files</Title>
				<div class="flex h-screen">
					<Sidebar />
					<main
						class={`flex-1 overflow-auto ${
							state() === "decrypting" ? "flex items-center justify-center" : ""
						}`}
					>
						<div class="mx-auto w-full max-w-6xl p-6 md:p-10">
							<Show when={state() === "ready"}>
								<div class="mb-6 rounded-xl border border-primary/30 bg-accent p-4">
									<div class="flex items-start gap-3">
										<IconSpan
											icon={TriangleAlert}
											class="mt-0.5 h-5 w-5 shrink-0 text-primary"
										/>
										<div class="min-w-0 flex-1">
											<h4 class="mb-1 text-sm font-semibold text-primary">
												One-Time Encrypted Transfer
											</h4>
											<p class="text-sm text-muted-foreground">
												This bundle will be destroyed from the server
												immediately after successful decryption.
											</p>
										</div>
									</div>
								</div>

								<FileInfoPanel />

								<div class="mt-4">
									<ActionButton
										icon={ShieldCheck}
										label="Unlock & Extract Files"
										onClick={handleUnlock}
									/>
								</div>
							</Show>

							<Show when={state() === "decrypting"}>
								<div class="flex flex-col items-center justify-center">
									<IconSpan
										icon={LoaderCircle}
										class="mb-4 h-10 w-10 text-primary spin-slow"
									/>
									<p class="text-sm font-medium text-foreground">
										Decrypting & Unzipping...
									</p>
									<p class="mt-1 text-xs text-muted-foreground">
										Preparing your files for download
									</p>
								</div>
							</Show>

							<Show when={state() === "extracted"}>
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
											`Bundle containing ${FILES.length} files: ${FILES.map((f) => f.name).join(", ")}`
										}
										fileName="entire-bundle.txt"
										mimeType="text/plain"
										class="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
									>
										<IconSpan icon={Download} class="h-5 w-5" />
										Download Entire Bundle
									</DownloadTrigger>
								</div>
							</Show>
						</div>
					</main>
				</div>
			</>
		</AuthGuard>
	);
}
