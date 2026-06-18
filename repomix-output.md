# Directory Structure
```
src/components/upload/DropZone.tsx
src/components/upload/SecureUpload.tsx
src/components/upload/SettingsPanel.tsx
src/components/upload/UploadProgress.tsx
src/components/upload/UploadSuccess.tsx
src/routes/api/auth/[...auth].ts
src/routes/api/files/complete-upload.ts
src/routes/api/files/finalize.ts
src/routes/api/files/initiate-upload.ts
src/routes/upload.tsx
src/types/upload.ts
src/utils/upload.ts
```

# Files

## File: src/routes/api/files/complete-upload.ts
```typescript
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { r2 } from "@/server/r2";
const BUCKET = process.env.R2_BUCKET!;
const SHARE_LINK_EXPIRATION_DAYS = 7;
const BodySchema = z.object({
	fileId: z.string().min(1),
	encrypted_size: z.number().int().positive(),
	etags: z
		.array(
			z.object({
				partNumber: z.number().int().positive(),
				etag: z.string().min(1),
			}),
		)
		.min(1),
});
export async function POST({ request }: { request: Request }) {
	const user = await requireUser(request);
	const raw = await request.json();
	const parsed = BodySchema.safeParse(raw);
	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid payload", issues: parsed.error.flatten() },
			{ status: 422 },
		);
	}
	const { fileId, encrypted_size, etags } = parsed.data;
	const file = await prisma.file.findUnique({
		where: { id: fileId },
		include: { uploadSessions: { where: { status: { not: "COMPLETED" } } } },
	});
	if (!file || file.userId !== user.id) {
		return Response.json({ error: "File not found" }, { status: 404 });
	}
	if (file.status !== "PENDING") {
		return Response.json({ error: "File is not in pending state" }, { status: 409 });
	}
	const session = file.uploadSessions[0];
	if (!session?.multipartUploadId) {
		return Response.json({ error: "No active upload session" }, { status: 409 });
	}
	const sortedParts = [...etags].sort((a, b) => a.partNumber - b.partNumber);
	const completeCmd = new CompleteMultipartUploadCommand({
		Bucket: BUCKET,
		Key: file.r2Key,
		UploadId: session.multipartUploadId,
		MultipartUpload: {
			Parts: sortedParts.map((e) => ({
				PartNumber: e.partNumber,
				ETag: e.etag,
			})),
		},
	});
	await r2.send(completeCmd);
	const shareLinkExpiresAt = new Date(
		Date.now() + SHARE_LINK_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
	);
	const [updatedFile, shareLink] = await prisma.$transaction([
		prisma.file.update({
			where: { id: fileId },
			data: {
				status: "READY",
				encryptedSize: BigInt(encrypted_size),
			},
		}),
		prisma.uploadSession.update({
			where: { id: session.id },
			data: {
				status: "COMPLETED",
				completedPartEtags: JSON.stringify(etags),
				completedAt: new Date(),
			},
		}),
		prisma.shareLink.create({
			data: {
				fileId,
				expiresAt: shareLinkExpiresAt,
			},
		}),
	]);
	return Response.json({
		fileId: updatedFile.id,
		status: updatedFile.status,
		encryptedSize: updatedFile.encryptedSize?.toString() ?? null,
		shareLink: {
			id: shareLink.id,
			expiresAt: shareLink.expiresAt?.toISOString() ?? null,
		},
	});
}
```

## File: src/routes/api/files/finalize.ts
```typescript
import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
const SHARE_LINK_EXPIRATION_DAYS = 7;
const BodySchema = z.object({
	fileId: z.string().min(1),
	encrypted_size: z.number().int().positive(),
});
export async function POST({ request }: { request: Request }) {
	const user = await requireUser(request);
	const raw = await request.json();
	const parsed = BodySchema.safeParse(raw);
	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid payload", issues: parsed.error.flatten() },
			{ status: 422 },
		);
	}
	const { fileId, encrypted_size } = parsed.data;
	const file = await prisma.file.findUnique({
		where: { id: fileId },
		select: { id: true, userId: true, status: true },
	});
	if (!file || file.userId !== user.id) {
		return Response.json({ error: "File not found" }, { status: 404 });
	}
	if (file.status !== "PENDING") {
		return Response.json({ error: "File is not in pending state" }, { status: 409 });
	}
	const hasSession = await prisma.uploadSession.findUnique({
		where: { fileId },
		select: { id: true },
	});
	if (hasSession) {
		return Response.json(
			{ error: "Use /complete-upload for multipart uploads" },
			{ status: 409 },
		);
	}
	const shareLinkExpiresAt = new Date(
		Date.now() + SHARE_LINK_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
	);
	const [updatedFile, shareLink] = await prisma.$transaction([
		prisma.file.update({
			where: { id: fileId },
			data: {
				status: "READY",
				encryptedSize: BigInt(encrypted_size),
			},
		}),
		prisma.shareLink.create({
			data: {
				fileId,
				expiresAt: shareLinkExpiresAt,
			},
		}),
	]);
	return Response.json({
		fileId: updatedFile.id,
		status: updatedFile.status,
		encryptedSize: updatedFile.encryptedSize?.toString() ?? null,
		shareLink: {
			id: shareLink.id,
			expiresAt: shareLink.expiresAt?.toISOString() ?? null,
		},
	});
}
```

## File: src/routes/api/files/initiate-upload.ts
```typescript
import {
	CreateMultipartUploadCommand,
	PutObjectCommand,
	UploadPartCommand,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import { prisma } from "@/db/project";
import { requireUser } from "@/lib/auth.server";
import { r2, getSignedUrl } from "@/server/r2";
import { r2FileKey } from "@/server/r2-keys";
const BUCKET = process.env.R2_BUCKET!;
const PRESIGN_EXPIRES = 60;
const MULTIPART_BATCH = 5;
const SINGLE_PUT_THRESHOLD = 50 * 1024 * 1024;
const DEFAULT_EXPIRATION_HOURS = 168;
const BodySchema = z.object({
	file_name: z.string().min(1).max(1024),
	mime_type: z.string().min(1),
	original_size: z.number().int().positive(),
	total_chunks: z.number().int().positive(),
	iv_base_hash: z.string().min(1),
});
export async function POST({ request }: { request: Request }) {
	const user = await requireUser(request);
	const raw = await request.json();
	const parsed = BodySchema.safeParse(raw);
	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid payload", issues: parsed.error.flatten() },
			{ status: 422 },
		);
	}
	const { file_name, mime_type, original_size, total_chunks, iv_base_hash } =
		parsed.data;
	const pref = await prisma.userPreference.findUnique({
		where: { userId: user.id },
		select: { defaultExpirationHours: true },
	});
	const expirationHours = pref?.defaultExpirationHours ?? DEFAULT_EXPIRATION_HOURS;
	const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
	const fileId = crypto.randomUUID();
	const r2Key = r2FileKey(user.id, fileId);
	if (original_size < SINGLE_PUT_THRESHOLD) {
		const command = new PutObjectCommand({
			Bucket: BUCKET,
			Key: r2Key,
			ContentType: mime_type,
		});
		const url = await getSignedUrl(r2, command, { expiresIn: PRESIGN_EXPIRES });
		const presignExpiresAt = new Date(Date.now() + PRESIGN_EXPIRES * 1000);
		const file = await prisma.file.create({
			data: {
				id: fileId,
				userId: user.id,
				fileName: file_name,
				mimeType: mime_type,
				originalSize: BigInt(original_size),
				totalChunks: total_chunks,
				ivBaseHash: iv_base_hash,
				r2Key,
				status: "PENDING",
				expiresAt,
			},
		});
		return Response.json({
			fileId: file.id,
			uploadId: null,
			presignedUrls: [{ partNumber: 1, url, expiresAt: presignExpiresAt.toISOString() }],
		});
	}
	const createCmd = new CreateMultipartUploadCommand({
		Bucket: BUCKET,
		Key: r2Key,
		ContentType: mime_type,
	});
	const multipart = await r2.send(createCmd);
	const file = await prisma.file.create({
		data: {
			id: fileId,
			userId: user.id,
			fileName: file_name,
			mimeType: mime_type,
			originalSize: BigInt(original_size),
			totalChunks: total_chunks,
			ivBaseHash: iv_base_hash,
			r2Key,
			status: "PENDING",
			expiresAt,
		},
	});
	const session = await prisma.uploadSession.create({
		data: {
			fileId: file.id,
			multipartUploadId: multipart.UploadId!,
			status: "INITIATED",
			totalParts: total_chunks,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
		},
	});
	const batch = Math.min(MULTIPART_BATCH, total_chunks);
	const urls = await Promise.all(
		Array.from({ length: batch }, (_, i) => {
			const partNumber = i + 1;
			const cmd = new UploadPartCommand({
				Bucket: BUCKET,
				Key: r2Key,
				PartNumber: partNumber,
				UploadId: multipart.UploadId!,
			});
			return getSignedUrl(r2, cmd, { expiresIn: PRESIGN_EXPIRES }).then(
				(url) => ({
					partNumber,
					url,
					expiresAt: new Date(Date.now() + PRESIGN_EXPIRES * 1000).toISOString(),
				}),
			);
		}),
	);
	return Response.json({
		fileId: file.id,
		uploadId: session.id,
		presignedUrls: urls,
	});
}
```

## File: src/components/upload/DropZone.tsx
```typescript
import { FileUpload } from "@ark-ui/solid/file-upload";
import { File as FileIcon, Lock, Upload, X } from "lucide-solid";
import { type Component, onCleanup, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import type { FileMetadata } from "@/types/upload";
import { formatFileSize } from "@/utils/upload";
interface DropZoneProps {
	onFileSelect: (file: File) => void;
	selectedFile: FileMetadata | null;
	onReset: () => void;
	disabled?: boolean;
}
const DropZone: Component<DropZoneProps> = (props) => {
	const handleFileAccept = (details: { files: File[] }) => {
		if (details.files.length > 0) {
			props.onFileSelect(details.files[0]);
		}
	};
	const handlePaste = (e: ClipboardEvent) => {
		if (props.disabled) return;
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (file) {
					props.onFileSelect(file);
					break;
				}
			}
		}
	};
	onMount(() => {
		if (isServer) return;
		document.addEventListener("paste", handlePaste);
	});
	onCleanup(() => {
		if (isServer) return;
		document.removeEventListener("paste", handlePaste);
	});
	return (
		<FileUpload.Root
			maxFiles={1}
			disabled={props.disabled}
			onFileAccept={handleFileAccept}
		>
			<FileUpload.Dropzone
				class="relative h-80 rounded-xl border-2 border-dashed border-border bg-card
               transition-all duration-300 hover:border-primary hover:bg-accent/30
               group cursor-pointer overflow-hidden"
			>
				<Show when={props.selectedFile} fallback={<DropZoneEmpty />}>
					<DropZoneSelected
						file={props.selectedFile!}
						onReset={props.onReset}
					/>
				</Show>
			</FileUpload.Dropzone>
			<FileUpload.HiddenInput />
		</FileUpload.Root>
	);
};
const DropZoneEmpty: Component = () => (
	<div class="flex flex-col items-center justify-center h-full relative z-10 p-6">
		<div
			class="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6
             group-hover:scale-110 group-hover:bg-primary/10 transition-all
             shadow-lg border border-border"
		>
			<Upload class="w-10 h-10 text-primary" stroke-width={1.5} />
		</div>
		<h3 class="font-heading text-xl text-foreground mb-2 text-center">
			Drop files here or click to browse
		</h3>
		<p class="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
			Supports all file types up to 50GB. <br />
			You can also paste a file from your clipboard (Ctrl+V / Cmd+V). <br />
			Files are zero-knowledge encrypted locally before transfer.
		</p>
	</div>
);
interface DropZoneSelectedProps {
	file: FileMetadata;
	onReset: () => void;
}
const DropZoneSelected: Component<DropZoneSelectedProps> = (props) => (
	<div class="absolute inset-0 bg-card/95 backdrop-blur-sm flex flex-col p-6 z-20">
		<div class="flex justify-between items-center mb-4 border-b border-border pb-4">
			<h4 class="text-sm font-semibold uppercase tracking-wider text-foreground">
				Selected Files (1)
			</h4>
			<button
				class="text-muted-foreground hover:text-destructive transition-colors
               p-1 hover:bg-destructive/10 rounded"
				onClick={(e) => {
					e.stopPropagation();
					props.onReset();
				}}
				aria-label="Remove selected file"
			>
				<X class="w-5 h-5" />
			</button>
		</div>
		<div class="flex items-center gap-4 bg-muted p-4 rounded-lg border border-border">
			<FileIcon class="w-8 h-8 text-primary shrink-0" />
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium text-foreground truncate">
					{props.file.name}
				</p>
				<p class="text-xs text-muted-foreground mt-1">
					{formatFileSize(props.file.size)}
				</p>
			</div>
			<Lock class="w-4 h-4 text-muted-foreground shrink-0" />
		</div>
	</div>
);
export default DropZone;
```

## File: src/components/upload/SecureUpload.tsx
```typescript
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
		handleReset();
	};
	const isSettingsPanelLocked = () =>
		phase() === "uploading" || phase() === "success";
	return (
		<>
			<div class="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full">
				<PageHeader />
				<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
					{}
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
									console.log("Navigate to file details");
								}}
							/>
						</Show>
					</div>
					{}
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
```

## File: src/components/upload/SettingsPanel.tsx
```typescript
import { NumberInput } from "@ark-ui/solid/number-input";
import { Select, createListCollection } from "@ark-ui/solid/select";
import { Switch } from "@ark-ui/solid/switch";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	ChevronsUpDownIcon,
	Lock,
	Settings,
} from "lucide-solid";
import { type Component, Index } from "solid-js";
import { Portal } from "solid-js/web";
import type { SecuritySettings } from "@/types/upload";
interface SettingsPanelProps {
	settings: SecuritySettings;
	onSettingsChange: (settings: SecuritySettings) => void;
	onUpload: () => void;
	disabled?: boolean;
	canUpload?: boolean;
}
const SettingsPanel: Component<SettingsPanelProps> = (props) => {
	const updateSetting = <K extends keyof SecuritySettings>(
		key: K,
		value: SecuritySettings[K],
	) => {
		props.onSettingsChange({ ...props.settings, [key]: value });
	};
	return (
		<div class="bg-card rounded-xl border border-border p-6 sticky top-24 shadow-sm">
			<h3 class="font-heading text-xl text-foreground mb-6 flex items-center gap-2.5">
				<Settings class="w-5 h-5 text-muted-foreground" />
				Security Settings
			</h3>
			<div class="flex flex-col gap-6">
				<ExpirationField
					value={props.settings.expiration}
					disabled={props.disabled}
					onChange={(v) => updateSetting("expiration", v)}
				/>
				<hr class="border-border/50" />
				<OneTimeDownloadField
					value={props.settings.oneTimeDownload}
					disabled={props.disabled}
					onChange={(v) => updateSetting("oneTimeDownload", v)}
				/>
				<hr class="border-border/50" />
				<MaxDownloadsField
					value={props.settings.maxDownloads}
					disabled={props.disabled}
					onChange={(v) => updateSetting("maxDownloads", v)}
				/>
			</div>
			<UploadAction
				onUpload={props.onUpload}
				disabled={props.disabled}
				canUpload={props.canUpload}
			/>
		</div>
	);
};
interface ExpirationFieldProps {
	value: string;
	disabled?: boolean;
	onChange: (value: string) => void;
}
const expirationOptions = createListCollection({
	items: [
		{ label: "24 Hours", value: "24h" },
		{ label: "7 Days", value: "7d" },
		{ label: "30 Days", value: "30d" },
		{ label: "Custom Date...", value: "custom" },
	],
});
const ExpirationField: Component<ExpirationFieldProps> = (props) => (
	<div>
		<Select.Root
			collection={expirationOptions}
			value={[props.value]}
			disabled={props.disabled}
			onValueChange={(details) => props.onChange(details.value[0])}
		>
			<Select.Label class="text-sm font-semibold text-foreground block mb-2">
				Expiration Time
			</Select.Label>
			<Select.Control class="relative">
				<Select.Trigger
					class="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground
                 focus:outline-none focus:ring-2 focus:ring-primary/20
                 focus:border-primary transition-colors cursor-pointer
                 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed
                 flex items-center justify-between"
					aria-label="Select expiration time"
				>
					<Select.ValueText placeholder="Select expiration" />
					<Select.Indicator>
						<ChevronsUpDownIcon class="w-4 h-4 text-muted-foreground" />
					</Select.Indicator>
				</Select.Trigger>
			</Select.Control>
			<Portal>
				<Select.Positioner>
					<Select.Content
						class="bg-muted border border-border rounded-lg shadow-lg p-1 z-50
                   min-w-[var(--reference-width)] max-h-60 overflow-y-auto"
					>
						<Index each={expirationOptions.items}>
							{(item) => (
								<Select.Item
									class="px-4 py-2 text-sm text-foreground rounded cursor-pointer
                         hover:bg-accent/50 data-[highlighted]:bg-accent/50
                         data-[state=checked]:text-primary flex items-center justify-between"
									item={item()}
								>
									<Select.ItemText>{item().label}</Select.ItemText>
									<Select.ItemIndicator class="text-primary">
										✓
									</Select.ItemIndicator>
								</Select.Item>
							)}
						</Index>
					</Select.Content>
				</Select.Positioner>
			</Portal>
			<Select.HiddenSelect />
		</Select.Root>
	</div>
);
interface OneTimeDownloadFieldProps {
	value: boolean;
	disabled?: boolean;
	onChange: (value: boolean) => void;
}
const OneTimeDownloadField: Component<OneTimeDownloadFieldProps> = (props) => (
	<Switch.Root
		checked={props.value}
		disabled={props.disabled}
		onCheckedChange={(details) => props.onChange(details.checked)}
		class="flex items-start justify-between gap-4 group"
	>
		<div class="flex-1">
			<Switch.Label
				class="text-sm font-semibold text-foreground cursor-pointer
             group-hover:text-primary transition-colors block"
			>
				One-Time Download
			</Switch.Label>
			<p class="text-xs text-muted-foreground mt-1 leading-relaxed">
				Destroys the file immediately after one view.
			</p>
		</div>
		<Switch.Control
			class="relative w-10 h-6 bg-muted rounded-full border border-border
             transition-colors duration-200 mt-0.5 shrink-0
             data-[state=checked]:bg-primary data-[state=checked]:border-primary
             data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
		>
			<Switch.Thumb
				class="absolute top-1 left-1 w-4 h-4 bg-muted-foreground rounded-full shadow-sm
               transition-transform duration-200
               data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground"
			/>
		</Switch.Control>
		<Switch.HiddenInput />
	</Switch.Root>
);
interface MaxDownloadsFieldProps {
	value: number | null;
	disabled?: boolean;
	onChange: (value: number | null) => void;
}
const MaxDownloadsField: Component<MaxDownloadsFieldProps> = (props) => (
	<div>
		<NumberInput.Root
			min={1}
			max={100}
			value={props.value?.toString() ?? ""}
			disabled={props.disabled}
			onValueChange={(details) => {
				const num = parseInt(details.value, 10);
				props.onChange(Number.isNaN(num) ? null : num);
			}}
			allowMouseWheel
			clampValueOnBlur
		>
			<NumberInput.Label class="text-sm font-semibold text-foreground block mb-2">
				Max Download Limit
			</NumberInput.Label>
			<NumberInput.Control class="relative">
				<NumberInput.Input
					class="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground
                 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                 transition-colors hover:border-primary/50
                 disabled:opacity-50 disabled:cursor-not-allowed"
					placeholder="Unlimited"
				/>
				<div class="absolute right-1 top-1 bottom-1 flex flex-col">
					<NumberInput.IncrementTrigger
						class="flex items-center justify-center w-6 h-full rounded
                   text-muted-foreground hover:text-foreground hover:bg-muted
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<ChevronUpIcon class="w-3.5 h-3.5" />
					</NumberInput.IncrementTrigger>
					<NumberInput.DecrementTrigger
						class="flex items-center justify-center w-6 h-full rounded
                   text-muted-foreground hover:text-foreground hover:bg-muted
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<ChevronDownIcon class="w-3.5 h-3.5" />
					</NumberInput.DecrementTrigger>
				</div>
			</NumberInput.Control>
		</NumberInput.Root>
		<p class="text-xs text-muted-foreground mt-2 text-right">
			Leave empty for unlimited within expiration.
		</p>
	</div>
);
interface UploadActionProps {
	onUpload: () => void;
	disabled?: boolean;
	canUpload?: boolean;
}
const UploadAction: Component<UploadActionProps> = (props) => (
	<div class="mt-8 pt-6 border-t border-border/50">
		<button
			class="w-full bg-primary text-primary-foreground py-3 rounded-lg text-sm font-semibold
             hover:bg-primary/90 transition-all flex items-center justify-center gap-2
             disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary
             relative overflow-hidden group shadow-sm hover:shadow-md
             active:scale-[0.98] transform duration-150"
			onClick={props.onUpload}
			disabled={props.disabled || !props.canUpload}
			title={!props.canUpload ? "Select a file first" : "Encrypt and upload"}
			aria-label="Start secure upload"
		>
			{}
			<div
				class="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent
               -translate-x-full group-hover:translate-x-full
               transition-transform duration-1000 ease-in-out"
			/>
			<Lock class="w-4 h-4" />
			Start Secure Upload
		</button>
	</div>
);
export default SettingsPanel;
```

## File: src/components/upload/UploadProgress.tsx
```typescript
import { Progress } from "@ark-ui/solid/progress";
import { Shield } from "lucide-solid";
import { type Component, Show } from "solid-js";
import { formatFileSize, getPhaseLabel } from "@/utils/upload";
interface UploadProgressProps {
	fileName: string;
	progress: number;
	uploadedSize: number;
	totalSize: number;
	onCancel: () => void;
}
const UploadProgress: Component<UploadProgressProps> = (props) => (
	<div class="bg-card rounded-xl p-6 border border-border flex flex-col gap-4 shadow-sm">
		<ProgressHeader fileName={props.fileName} progress={props.progress} />
		<Progress.Root value={props.progress} max={100}>
			<Progress.Track class="w-full h-2 bg-muted rounded-full overflow-hidden">
				<Progress.Range class="h-full bg-primary rounded-full transition-all duration-300 ease-out" />
			</Progress.Track>
		</Progress.Root>
		<ProgressFooter
			uploadedSize={props.uploadedSize}
			totalSize={props.totalSize}
			onCancel={props.onCancel}
		/>
	</div>
);
const ProgressHeader: Component<{ fileName: string; progress: number }> = (
	props,
) => (
	<div class="flex justify-between items-start gap-4">
		<div class="flex-1 min-w-0">
			<h4 class="text-sm font-semibold text-foreground flex items-center gap-2">
				<Show when={props.progress > 30}>
					<Shield class="w-4 h-4 text-primary shrink-0" />
				</Show>
				<span>{getPhaseLabel(props.progress)}</span>
			</h4>
			<p class="text-xs text-muted-foreground mt-1 truncate">
				{props.fileName}
			</p>
		</div>
		<span class="text-sm font-bold text-primary tabular-nums">
			{props.progress}%
		</span>
	</div>
);
interface ProgressFooterProps {
	uploadedSize: number;
	totalSize: number;
	onCancel: () => void;
}
const ProgressFooter: Component<ProgressFooterProps> = (props) => (
	<div class="flex justify-between items-center">
		<p class="text-xs text-muted-foreground font-medium tabular-nums">
			{formatFileSize(props.uploadedSize)} / {formatFileSize(props.totalSize)}
		</p>
		<button
			class="text-xs font-semibold text-destructive hover:text-destructive/80
             transition-colors px-2 py-1 rounded hover:bg-destructive/10"
			onClick={props.onCancel}
		>
			Cancel
		</button>
	</div>
);
export default UploadProgress;
```

## File: src/components/upload/UploadSuccess.tsx
```typescript
import { CircleCheck, Copy, Info, Key, Plus } from "lucide-solid";
import { type Component, createSignal, Show } from "solid-js";
import type { ShareData } from "@/types/upload";
interface UploadSuccessProps {
	shareData: ShareData;
	onNewUpload: () => void;
	onViewDetails?: () => void;
}
const UploadSuccess: Component<UploadSuccessProps> = (props) => (
	<div
		class="bg-card rounded-xl p-8 border border-secondary/30
           relative overflow-hidden shadow-sm"
	>
		{}
		<div class="absolute top-0 left-0 w-1 h-full bg-primary" />
		<div class="flex flex-col sm:flex-row items-start gap-6">
			<SuccessIcon />
			<div class="flex-1 min-w-0 w-full">
				<h3 class="font-heading text-xl text-foreground mb-2">
					Upload Complete &amp; Secured
				</h3>
				<p class="text-sm text-muted-foreground mb-6 leading-relaxed">
					File has been encrypted and stored in the secure vault. Share the link
					and key below.
				</p>
				<ShareLinkBox shareData={props.shareData} />
				<div class="flex justify-between items-center mt-3">
					<span class="text-xs text-primary flex items-center gap-1.5 font-medium">
						<Info class="w-3.5 h-3.5" />
						End-to-end decryption key included in URL
					</span>
				</div>
			</div>
		</div>
		<SuccessActions
			onNewUpload={props.onNewUpload}
			onViewDetails={props.onViewDetails}
		/>
	</div>
);
const SuccessIcon: Component = () => (
	<div
		class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center
           shrink-0 border border-primary/20"
	>
		<CircleCheck class="w-6 h-6 text-primary" />
	</div>
);
interface ShareLinkBoxProps {
	shareData: ShareData;
}
const ShareLinkBox: Component<ShareLinkBoxProps> = (props) => {
	const [copied, setCopied] = createSignal(false);
	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(
				`${props.shareData.url}#key=${props.shareData.key}`,
			);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy to clipboard:", err);
		}
	};
	return (
		<div
			class="bg-muted rounded-lg border border-border p-4 text-sm break-all
             relative group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
		>
			<span class="text-foreground font-mono">{props.shareData.url}</span>
			<span
				class="text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20
               inline-flex items-center gap-1.5 text-xs font-mono whitespace-nowrap w-fit"
				title="End-to-end decryption key"
			>
				#key={props.shareData.key}
				<Key class="w-3 h-3" />
			</span>
			<button
				class="sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2
               text-muted-foreground hover:text-primary transition-all
               bg-card p-1.5 rounded border border-border hover:border-primary
               flex items-center gap-1.5 ml-auto sm:ml-0 shadow-sm"
				onClick={copyLink}
				title="Copy full link to clipboard"
				aria-label="Copy share link"
			>
				<Show when={copied()} fallback={<Copy class="w-4 h-4" />}>
					<span class="text-xs font-bold text-primary px-1">Copied!</span>
				</Show>
			</button>
		</div>
	);
};
interface SuccessActionsProps {
	onNewUpload: () => void;
	onViewDetails?: () => void;
}
const SuccessActions: Component<SuccessActionsProps> = (props) => (
	<div class="mt-8 flex flex-wrap gap-3 border-t border-border/50 pt-6">
		<button
			class="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold
             hover:bg-primary/90 transition-colors flex items-center gap-2
             shadow-sm hover:shadow-md active:scale-95 transform duration-150"
			onClick={props.onNewUpload}
		>
			<Plus class="w-4 h-4" />
			New Upload
		</button>
		<button
			class="border border-border text-foreground px-6 py-2.5 rounded-lg text-sm font-medium
             hover:bg-muted transition-colors bg-card"
			onClick={props.onViewDetails}
		>
			View File Details
		</button>
	</div>
);
export default UploadSuccess;
```

## File: src/routes/api/auth/[...auth].ts
```typescript
import { toSolidStartHandler } from "better-auth/solid-start";
import { auth } from "@/lib/auth";
export const { GET, POST } = toSolidStartHandler(auth);
```

## File: src/routes/upload.tsx
```typescript
import { Title } from "@solidjs/meta";
import { Sidebar } from "@/components/sidebar/Sidebar";
import SecureUpload from "@/components/upload/SecureUpload";
import AuthGuard from "@/components/auth/auth-guard";
export default function upload() {
	return (
		<AuthGuard>
			<>
				<Title>Upload</Title>
				<div class="flex h-screen">
					<Sidebar />
					<main class="flex-1 w-full max-w-max-content-width mx-auto px-6">
						<SecureUpload />
					</main>
				</div>
			</>
		</AuthGuard>
	);
}
```

## File: src/types/upload.ts
```typescript
export type Phase = "idle" | "selecting" | "uploading" | "success" | "error";
export interface FileMetadata {
	name: string;
	size: number;
}
export interface ShareData {
	url: string;
	key: string;
}
export interface SecuritySettings {
	expiration: string;
	oneTimeDownload: boolean;
	maxDownloads: number | null;
}
```

## File: src/utils/upload.ts
```typescript
export const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};
export const getPhaseLabel = (progress: number): string => {
	if (progress < 20) return "Preparing file...";
	if (progress < 50) return "Encrypting...";
	if (progress < 90) return "Uploading securely...";
	return "Finalizing...";
};
export const generateShareData = () => ({
	url: "https://secureshare.corp/v/a8f72",
	key: "x9k2mPq4zL8",
});
```
