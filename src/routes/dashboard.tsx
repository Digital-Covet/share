import { Title } from "@solidjs/meta";
import { Info } from "lucide-solid";
import { createSignal, createMemo } from "solid-js";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DeleteConfirmModal } from "@/components/dashboard/DeleteConfirmModal";
import { EditExpiryModal } from "@/components/dashboard/EditExpiryModal";
import { FileTable } from "@/components/dashboard/FileTable";
import { StatsOverview } from "@/components/dashboard/StatOverview";
import { Toast } from "@/components/dashboard/Toast";
import { Sidebar } from "@/components/sidebar/Sidebar";
import type { FileItem } from "@/types/dashboard";
import AuthGuard from "@/components/auth/auth-guard";

const mockFiles: FileItem[] = [
	{
		id: "1",
		name: "Q4-Financial-Report.pdf",
		sizeBytes: 2457600,
		sizeFormatted: "2.4 MB",
		status: "Active",
		expiryDisplay: "Dec 31, 2026",
		expiryTimestamp: new Date("2026-12-31").getTime(),
		downloads: 45,
		type: "pdf",
	},
	{
		id: "2",
		name: "Project-Assets.zip",
		sizeBytes: 15728640,
		sizeFormatted: "15 MB",
		status: "Active",
		expiryDisplay: "Never",
		expiryTimestamp: Infinity,
		downloads: 128,
		type: "zip",
	},
	{
		id: "3",
		name: "Client-Contract.docx",
		sizeBytes: 1048576,
		sizeFormatted: "1 MB",
		status: "One-Time",
		expiryDisplay: "Upon DL",
		expiryTimestamp: 0,
		downloads: 1,
		type: "document",
	},
	{
		id: "4",
		name: "Campaign-Banner.png",
		sizeBytes: 5242880,
		sizeFormatted: "5 MB",
		status: "Expired",
		expiryDisplay: "Jan 1, 2025",
		expiryTimestamp: new Date("2025-01-01").getTime(),
		downloads: 210,
		type: "image",
	},
	{
		id: "5",
		name: "Budget-2026.xlsx",
		sizeBytes: 786432,
		sizeFormatted: "768 KB",
		status: "Pending",
		expiryDisplay: "Mar 15, 2026",
		expiryTimestamp: new Date("2026-03-15").getTime(),
		downloads: 12,
		type: "spreadsheet",
	},
];

export default function Dashboard() {
	const [files, setFiles] = createSignal<FileItem[]>(mockFiles);

	const [searchTerm, setSearchTerm] = createSignal("");
	const [statusFilter, setStatusFilter] = createSignal("All");
	const [sortField, setSortField] = createSignal("name");
	const [sortDirection, setSortDirection] = createSignal<"asc" | "desc">("asc");

	const [isEditOpen, setIsEditOpen] = createSignal(false);
	const [isDeleteOpen, setIsDeleteOpen] = createSignal(false);
	const [selectedFile, setSelectedFile] = createSignal<FileItem | null>(null);
	const [toastMessage, setToastMessage] = createSignal("");
	const [isToastOpen, setIsToastOpen] = createSignal(false);

	const BASE_ACTIVE_LINKS = 12;
	const BASE_DOWNLOADS = 869;
	const BASE_STORAGE_GB = 43.0;

	const activeLinks = createMemo(() => {
		const mockActiveCount = files().filter((f) => f.status === "Active").length;
		return BASE_ACTIVE_LINKS + mockActiveCount;
	});

	const totalDownloads = createMemo(() => {
		const mockDownloadsSum = files().reduce((sum, f) => sum + f.downloads, 0);
		return BASE_DOWNLOADS + mockDownloadsSum;
	});

	const storageUsedGB = createMemo(() => {
		const totalBytes = files().reduce((sum, f) => sum + f.sizeBytes, 0);
		const mockGB = totalBytes / (1024 * 1024 * 1024);
		return BASE_STORAGE_GB + mockGB;
	});

	const handleCopyLink = (file: FileItem) => {
		const dummyUrl = `https://share.securetransfer.net/f/${file.id}-${file.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard
				.writeText(dummyUrl)
				.then(() => showToast(`Link copied to clipboard for: ${file.name}`))
				.catch(() =>
					showToast(`Failed to copy link. Generated link: ${dummyUrl}`),
				);
		} else {
			showToast(`Link generated: ${dummyUrl}`);
		}
	};

	const handleTriggerEditExpiry = (file: FileItem) => {
		setSelectedFile(file);
		setIsEditOpen(true);
	};

	const handleSaveExpiry = (
		fileId: string,
		display: string,
		timestamp: number,
	) => {
		setFiles((prev) =>
			prev.map((file) => {
				if (file.id === fileId) {
					let updatedStatus = file.status;
					if (display === "Upon DL") {
						updatedStatus = "One-Time";
					} else if (display === "Never") {
						updatedStatus = "Active";
					} else if (file.status === "Expired" && timestamp > Date.now()) {
						updatedStatus = "Active";
					}

					return {
						...file,
						expiryDisplay: display,
						expiryTimestamp: timestamp,
						status: updatedStatus,
					};
				}
				return file;
			}),
		);

		const file = files().find((f) => f.id === fileId);
		if (file) {
			showToast(`Expiry updated successfully for: ${file.name}`);
		}
	};

	const handleTriggerDelete = (file: FileItem) => {
		setSelectedFile(file);
		setIsDeleteOpen(true);
	};

	const handleConfirmDelete = (fileId: string) => {
		const fileToDelete = files().find((f) => f.id === fileId);
		if (fileToDelete) {
			setFiles((prev) => prev.filter((file) => file.id !== fileId));
			showToast(`Revoked transfer link and deleted: ${fileToDelete.name}`);
		}
	};

	const showToast = (msg: string) => {
		setToastMessage(msg);
		setIsToastOpen(true);
		setTimeout(() => {
			setIsToastOpen(false);
		}, 3500);
	};

	const handleResetFilters = () => {
		setSearchTerm("");
		setStatusFilter("All");
		setSortField("name");
		setSortDirection("asc");
		showToast("Filters and sorting have been reset");
	};

	const processedFiles = createMemo(() => {
		let result = [...files()];

		const search = searchTerm().toLowerCase().trim();
		if (search) {
			result = result.filter((file) =>
				file.name.toLowerCase().includes(search),
			);
		}

		const status = statusFilter();
		if (status !== "All") {
			result = result.filter((file) => file.status === status);
		}

		const field = sortField();
		const dir = sortDirection();

		result.sort((a, b) => {
			let comparison = 0;

			if (field === "name") {
				comparison = a.name.localeCompare(b.name);
			} else if (field === "size") {
				comparison = a.sizeBytes - b.sizeBytes;
			} else if (field === "downloads") {
				comparison = a.downloads - b.downloads;
			} else if (field === "expiry") {
				comparison = a.expiryTimestamp - b.expiryTimestamp;
			}

			return dir === "asc" ? comparison : -comparison;
		});

		return result;
	});

	return (
		<AuthGuard>
			<>
				<Title>Dashboard</Title>
				<div class="flex h-screen">
					<Sidebar />
					<main class="flex-1 overflow-auto px-6">
						<main class="flex-1 w-full max-w-max-content-width mx-auto p-6 md:p-10">
							<DashboardHeader
								searchTerm={searchTerm()}
								setSearchTerm={setSearchTerm}
								statusFilter={statusFilter()}
								setStatusFilter={setStatusFilter}
								sortField={sortField()}
								setSortField={setSortField}
								sortDirection={sortDirection()}
								setSortDirection={setSortDirection}
								onResetFilters={handleResetFilters}
							/>

							<StatsOverview
								activeLinks={activeLinks()}
								totalDownloads={totalDownloads()}
								storageUsedGB={storageUsedGB()}
							/>

							<FileTable
								files={processedFiles()}
								onCopyLink={handleCopyLink}
								onEditExpiry={handleTriggerEditExpiry}
								onDelete={handleTriggerDelete}
							/>

							<div class="mt-8 bg-surface-container-low/50 border border-outline-variant/50 rounded-xl p-4 flex items-start gap-3">
								<div class="text-primary p-1 shrink-0">
									<Info size={16} />
								</div>
								<div class="text-xs text-on-surface-variant leading-relaxed">
									<strong class="text-on-surface font-semibold">
										Active links management policy:
									</strong>{" "}
									Expired links are deactivated automatically and cannot be
									accessed by external clients. Revoked or deleted files
									immediately remove user access tokens and shred corresponding
									file indices in compliance with the Zero-Trust policy.
								</div>
							</div>
						</main>

						<EditExpiryModal
							file={selectedFile()}
							isOpen={isEditOpen()}
							onClose={() => {
								setIsEditOpen(false);
								setSelectedFile(null);
							}}
							onSave={handleSaveExpiry}
						/>

						<DeleteConfirmModal
							file={selectedFile()}
							isOpen={isDeleteOpen()}
							onClose={() => {
								setIsDeleteOpen(false);
								setSelectedFile(null);
							}}
							onConfirm={handleConfirmDelete}
						/>

						<Toast
							message={toastMessage()}
							isOpen={isToastOpen()}
							onClose={() => setIsToastOpen(false)}
						/>
					</main>
				</div>
			</>
		</AuthGuard>
	);
}
