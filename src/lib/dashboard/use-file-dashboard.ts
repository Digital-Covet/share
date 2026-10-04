import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { DashboardStats, FileItem } from "@/types/dashboard";
import { applyFileView, type FileViewOptions } from "./filters";
import {
	fetchFiles,
	revokeFile,
	shareUrl,
	updateExpiry,
} from "./files-api";
import { STATUS_PRESENTATION } from "./status";

export const PAGE_SIZE = 10;

const CLOCK_TICK_MS = 30_000;
const NOTICE_MS = 4_000;
const BYTES_PER_GB = 1024 ** 3;

export interface Notice {
	tone: "success" | "error";
	message: string;
}

function isLive(file: FileItem): boolean {
	return STATUS_PRESENTATION[file.status].live;
}

function isRevoked(file: FileItem): boolean {
	return STATUS_PRESENTATION[file.status].filter === "revoked";
}

function computeStats(files: FileItem[]): DashboardStats {
	return {
		activeLinks: files.filter(isLive).length,
		totalDownloads: files.reduce((sum, f) => sum + f.downloads, 0),
		storageUsedGB:
			files.filter((f) => !isRevoked(f)).reduce((sum, f) => sum + f.sizeBytes, 0) /
			BYTES_PER_GB,
	};
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : "Something went wrong.";
}

export function useFileDashboard() {
	const [files, setFiles] = createSignal<FileItem[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [view, setViewState] = createSignal<FileViewOptions>({
		query: "",
		status: "all",
		sort: "expiry",
	});
	const [page, setPage] = createSignal(1);
	const [now, setNow] = createSignal(Date.now());
	const [notice, setNotice] = createSignal<Notice | null>(null);
	const [revokeTarget, setRevokeTarget] = createSignal<FileItem | null>(null);
	const [revoking, setRevoking] = createSignal(false);

	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	function announce(next: Notice) {
		clearTimeout(noticeTimer);
		setNotice(next);
		noticeTimer = setTimeout(() => setNotice(null), NOTICE_MS);
	}

	async function load() {
		try {
			setFiles(await fetchFiles());
		} catch (err) {
			announce({ tone: "error", message: errorMessage(err) });
		} finally {
			setLoading(false);
		}
	}

	onMount(() => {
		void load();
		const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
		onCleanup(() => {
			clearInterval(clock);
			clearTimeout(noticeTimer);
		});
	});

	const filtered = createMemo(() => applyFileView(files(), view()));
	const pageFiles = createMemo(() =>
		filtered().slice((page() - 1) * PAGE_SIZE, page() * PAGE_SIZE),
	);
	const stats = createMemo(() => computeStats(files()));
	const expiredCount = createMemo(
		() => files().filter((f) => f.status === "Expired").length,
	);

	function setView(next: FileViewOptions) {
		setViewState(next);
		setPage(1);
	}

	async function copyLink(file: FileItem) {
		if (!file.shareLinkId) return;
		try {
			await navigator.clipboard.writeText(shareUrl(file.shareLinkId));
			announce({ tone: "success", message: "Share link copied." });
		} catch {
			announce({ tone: "error", message: "Could not access the clipboard." });
		}
	}

	async function saveExpiry(file: FileItem, expiresAt: number) {
		try {
			await updateExpiry({
				fileId: file.id,
				expiresAt,
				isOneTime: file.status === "One-Time",
			});
			await load();
			announce({ tone: "success", message: "Expiry updated." });
		} catch (err) {
			announce({ tone: "error", message: errorMessage(err) });
		}
	}

	async function confirmRevoke(file: FileItem) {
		setRevoking(true);
		try {
			await revokeFile(file.id);
			await load();
			setRevokeTarget(null);
			announce({ tone: "success", message: "Transfer revoked." });
		} catch (err) {
			announce({ tone: "error", message: errorMessage(err) });
		} finally {
			setRevoking(false);
		}
	}

	async function purgeExpired() {
		const expired = files().filter((f) => f.status === "Expired");
		const results = await Promise.allSettled(expired.map((f) => revokeFile(f.id)));
		await load();
		const failed = results.filter((r) => r.status === "rejected").length;
		announce(
			failed === 0
				? { tone: "success", message: `Purged ${expired.length} expired files.` }
				: { tone: "error", message: `${failed} files could not be purged.` },
		);
	}

	return {
		loading,
		now,
		notice,
		view,
		setView,
		page,
		setPage,
		filteredCount: () => filtered().length,
		pageFiles,
		stats,
		expiredCount,
		revokeTarget,
		revoking,
		requestRevoke: setRevokeTarget,
		cancelRevoke: () => setRevokeTarget(null),
		confirmRevoke,
		copyLink,
		saveExpiry,
		purgeExpired,
	};
}
