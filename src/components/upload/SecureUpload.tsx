import { type Component, createSignal, Show } from "solid-js";
import type {
	FileMetadata,
	Phase,
	SecuritySettings,
	ShareData,
} from "@/types/upload";
import { generateShareData } from "@/utils/upload";
import DropZone from "./DropZone";
import SettingsPanel from "./SettingsPanel";
import UploadProgress from "./UploadProgress";
import UploadSuccess from "./UploadSuccess";

const DEFAULT_SETTINGS: SecuritySettings = {
	expiration: "24h",
	oneTimeDownload: false,
	maxDownloads: 10,
};

const SecureUpload: Component = () => {
	const [phase, setPhase] = createSignal<Phase>("idle");
	const [selectedFile, setSelectedFile] = createSignal<FileMetadata | null>(
		null,
	);
	const [uploadProgress, setUploadProgress] = createSignal(0);
	const [shareData, setShareData] = createSignal<ShareData | null>(null);
	const [settings, setSettings] =
		createSignal<SecuritySettings>(DEFAULT_SETTINGS);

	// Derived: how many bytes have been transferred so far
	const uploadedSize = () => {
		const file = selectedFile();
		if (!file) return 0;
		return Math.floor((file.size * uploadProgress()) / 100);
	};

	const handleFileSelect = (file: File) => {
		setSelectedFile({ name: file.name, size: file.size });
		setPhase("selecting");
	};

	const handleReset = () => {
		setSelectedFile(null);
		setUploadProgress(0);
		setShareData(null);
		setPhase("idle");
	};

	const handleUpload = () => {
		if (!selectedFile()) return;

		setPhase("uploading");
		setUploadProgress(0);

		const interval = setInterval(() => {
			setUploadProgress((prev) => {
				if (prev >= 100) {
					clearInterval(interval);
					setShareData(generateShareData());
					setPhase("success");
					return 100;
				}
				// Simulate variable network speed
				const remaining = 100 - prev;
				const increment = Math.max(
					1,
					Math.min(remaining, Math.floor(Math.random() * 8) + 2),
				);
				return prev + increment;
			});
		}, 250);
	};

	const handleCancel = () => {
		// In production: abort the pending fetch / XHR here before resetting.
		handleReset();
	};

	const isSettingsPanelLocked = () =>
		phase() === "uploading" || phase() === "success";

	return (
		<>
			<div class="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full">
				<PageHeader />

				<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
					{/* ── Left column: contextual upload phases ── */}
					<div class="lg:col-span-8 flex flex-col gap-6">
						<Show when={phase() === "idle" || phase() === "selecting"}>
							<DropZone
								onFileSelect={handleFileSelect}
								selectedFile={selectedFile()}
								onReset={handleReset}
								disabled={phase() === "uploading"}
							/>
						</Show>

						<Show when={phase() === "uploading"}>
							<UploadProgress
								fileName={selectedFile()?.name ?? ""}
								progress={uploadProgress()}
								uploadedSize={uploadedSize()}
								totalSize={selectedFile()?.size ?? 0}
								onCancel={handleCancel}
							/>
						</Show>

						<Show when={phase() === "success" && shareData() !== null}>
							<UploadSuccess
								shareData={shareData()!}
								onNewUpload={handleReset}
								onViewDetails={() => {
									// Navigate to file details page in a real app
									console.log("Navigate to file details");
								}}
							/>
						</Show>
					</div>

					{/* ── Right column: settings ── */}
					<div class="lg:col-span-4">
						<SettingsPanel
							settings={settings()}
							onSettingsChange={setSettings}
							onUpload={handleUpload}
							disabled={isSettingsPanelLocked()}
							canUpload={phase() === "selecting"}
						/>
					</div>
				</div>
			</div>
		</>
	);
};

// ---- Page-level header (static, no props needed) ----

const PageHeader: Component = () => (
	<div class="mb-8">
		<h2 class="font-heading font-bold text-foreground tracking-tight">
			Secure Upload
		</h2>
		<p class="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
			End-to-end encrypted file sharing for sensitive enterprise data. Files are
			encrypted client-side before upload.
		</p>
	</div>
);

export default SecureUpload;
