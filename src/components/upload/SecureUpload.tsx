import { type Component, createSignal, Show } from "solid-js";
import type {
	CompleteUploadResponse,
	FileMetadata,
	InitiateUploadResponse,
	Phase,
	SecuritySettings,
	ShareData,
} from "@/types/upload";
import { CHUNK_SIZE, getTotalChunks } from "@/utils/upload";
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

	const handleUpload = async () => {
		if (!selectedFile()) return;
		setPhase("uploading");
		setUploadProgress(0);

		const file = selectedFile()!;
		const currentSettings = settings();

		try {
			const initRes = await fetch("/api/files/initiate-upload", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					file_name: file.name,
					mime_type: "application/octet-stream",
					original_size: file.size,
					total_chunks: getTotalChunks(file.size),
					iv_base_hash: "placeholder_hash_day3",
				}),
			});
			if (!initRes.ok) throw new Error("Init failed");
			const { fileId, uploadId, presignedUrls }: InitiateUploadResponse =
				await initRes.json();

			const etags: { partNumber: number; etag: string }[] = [];
			for (let i = 0; i < presignedUrls.length; i++) {
				const { partNumber, url } = presignedUrls[i];
				const chunkData = new Uint8Array(
					Math.min(CHUNK_SIZE, file.size - i * CHUNK_SIZE),
				);

				const chunkRes = await fetch(url, {
					method: "PUT",
					body: chunkData,
				});
				if (!chunkRes.ok) throw new Error(`Chunk ${partNumber} upload failed`);

				const etag = chunkRes.headers.get("ETag");
				if (!etag) throw new Error("Missing ETag");
				etags.push({ partNumber, etag });

				setUploadProgress(
					Math.floor(((i + 1) / presignedUrls.length) * 100),
				);
			}

			const isMultipart = uploadId !== null;
			const completeRes = await fetch(
				isMultipart ? "/api/files/complete-upload" : "/api/files/finalize",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						fileId,
						encrypted_size: file.size,
						...(isMultipart ? { etags } : {}),
						security_settings: currentSettings,
					}),
				},
			);

			if (!completeRes.ok) throw new Error("Finalize failed");
			const { shareLink }: CompleteUploadResponse = await completeRes.json();

			setShareData({
				url: `${window.location.origin}/s/${fileId}`,
				key: "placeholder_key_day3",
			});
			setPhase("success");
		} catch (error) {
			console.error("Upload failed:", error);
			setPhase("error");
		}
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
