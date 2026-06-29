import { Download, Loader2, Shield, ShieldCheck } from "lucide-solid";
import { createSignal, Show } from "solid-js";

import { ActionButton } from "@/components/recieve/ActionButton";
import { ExtractedFiles } from "@/components/recieve/ExtractedFiles";
import { FileInfoPanel } from "@/components/recieve/FileInfoPanel";
import { IconSpan } from "@/components/recieve/IconSpan";
import type { FileItem } from "@/types/recieve";

const MOCK_FILES: FileItem[] = [
	{ id: "1", name: "Strategy_Deck.pdf", type: "PDF", size: "2.4 MB", sizeBytes: 2516582, receivedDate: "Jun 10, 2026", downloads: 0 },
	{ id: "2", name: "Launch_Banner.png", type: "Image", size: "5.1 MB", sizeBytes: 5347737, receivedDate: "Jun 10, 2026", downloads: 0 },
	{ id: "3", name: "Budget_Q3.xlsx", type: "Spreadsheet", size: "768 KB", sizeBytes: 786432, receivedDate: "Jun 9, 2026", downloads: 0 },
];

type ViewerState = "ready" | "decrypting" | "extracted";

export default function SecureShareViewer() {
	const [state, setState] = createSignal<ViewerState>("ready");

	const handleUnlock = () => {
		setState("decrypting");

		setTimeout(() => {
			setState("extracted");
		}, 2000);
	};

	return (
		<div class="bg-grid-pattern relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-8 text-foreground">
			<div class="pointer-events-none absolute inset-x-0 top-0 h-[512px] bg-gradient-to-b from-primary/10 via-background/50 to-background" />

			<div class="z-10 mb-8 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-lg">
					<IconSpan icon={Shield} class="h-6 w-6 text-primary" />
				</div>

				<span class="font-heading text-2xl font-bold tracking-tight">
					SecureShare
				</span>
			</div>

			<div class="relative z-10 w-full max-w-[460px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
				<div class="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

				<div class="flex min-h-[360px] flex-col p-8">
				<div class="mb-6 flex items-center gap-2 text-muted-foreground">
					<IconSpan icon={Shield} class="h-4 w-4" />
					<span class="text-label">Secure File Transfer</span>
				</div>

					<Show when={state() !== "extracted"}>
						<FileInfoPanel fileCount={14} totalSize="2.1 GB" />
					</Show>

					<Show when={state() === "extracted"}>
						<ExtractedFiles files={MOCK_FILES} viewMode="list" selected={new Set<string>()} onToggleSelect={() => {}} onSelectAll={() => {}} onClearSelection={() => {}} />
					</Show>

					<div class="mt-auto">
						<Show
							when={state() !== "extracted"}
							fallback={
								<ActionButton
									icon={Download}
									label="Download Entire Bundle"
									secondary
								/>
							}
						>
						<ActionButton
							icon={state() === "decrypting" ? Loader2 : ShieldCheck}
							label={
								state() === "decrypting"
									? "Extracting..."
									: "Extract Files"
							}
							disabled={state() === "decrypting"}
							loading={state() === "decrypting"}
							onClick={handleUnlock}
						/>
						</Show>
					</div>
				</div>
			</div>
		</div>
	);
}
