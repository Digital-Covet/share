import { createMemo, createSignal, onCleanup } from "solid-js";
import { shareUrl } from "@/lib/dashboard/files-api";
import type { Notice } from "@/lib/dashboard/use-file-dashboard";
import type {
	AccessSettings,
	ChunkStatus,
	StagedFile,
	UploadPhase,
	UploadReceipt,
} from "@/types/upload";
import { getTotalChunks } from "@/utils/upload";
import {
	accessError,
	DEFAULT_ACCESS_SETTINGS,
	passphraseOf,
	toSecuritySettings,
} from "./access-settings";
import {
	buildPayload,
	stageFiles,
	stagingError,
	stagingTotals,
} from "./staging";
import { runUpload } from "./upload-pipeline";

const NOTICE_MS = 4_000;
const BYTES_PER_MB = 1024 * 1024;

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : "Something went wrong.";
}

export function useUploadEngine() {
	const [staged, setStaged] = createSignal<StagedFile[]>([]);
	const [settings, setSettings] = createSignal<AccessSettings>(DEFAULT_ACCESS_SETTINGS);
	const [phase, setPhase] = createSignal<UploadPhase>("idle");
	const [chunkStates, setChunkStates] = createSignal<ChunkStatus[]>([]);
	const [speedMbps, setSpeedMbps] = createSignal(0);
	const [fingerprint, setFingerprint] = createSignal<string | null>(null);
	const [receipt, setReceipt] = createSignal<UploadReceipt | null>(null);
	const [notice, setNotice] = createSignal<Notice | null>(null);

	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => clearTimeout(noticeTimer));

	function announce(next: Notice) {
		clearTimeout(noticeTimer);
		setNotice(next);
		noticeTimer = setTimeout(() => setNotice(null), NOTICE_MS);
	}

	const totals = createMemo(() => stagingTotals(staged()));
	const locked = () => phase() === "encrypting" || phase() === "success";
	const canSubmit = createMemo(() => staged().length > 0 && phase() === "staged");

	function addFiles(files: File[]) {
		if (locked() || files.length === 0) return;
		const next = [...staged(), ...stageFiles(files)];
		const problem = stagingError(next);
		if (problem) return announce({ tone: "error", message: problem });
		setStaged(next);
		setPhase("staged");
	}

	function removeFile(id: string) {
		if (locked()) return;
		const next = staged().filter((entry) => entry.id !== id);
		setStaged(next);
		setPhase(next.length === 0 ? "idle" : "staged");
	}

	function updateChunk(index: number, status: ChunkStatus) {
		setChunkStates((prev) => {
			const next = prev.slice();
			next[index] = status;
			return next;
		});
	}

	function trackSpeed() {
		const startedAt = performance.now();
		let uploaded = 0;
		return (bytes: number) => {
			uploaded += bytes;
			const seconds = (performance.now() - startedAt) / 1000;
			setSpeedMbps(seconds > 0 ? uploaded / BYTES_PER_MB / seconds : 0);
		};
	}

	async function submit() {
		const files = staged();
		const problem = accessError(settings());
		if (problem) return announce({ tone: "error", message: problem });
		if (files.length === 0) return;

		setPhase("encrypting");
		setFingerprint(null);
		setSpeedMbps(0);
		try {
			const payload = await buildPayload(files);
			setChunkStates(new Array(getTotalChunks(payload.blob.size)).fill("pending"));
			const password = passphraseOf(settings());
			const result = await runUpload(
				{ payload, settings: toSecuritySettings(settings()), password },
				{ onFingerprint: setFingerprint, onChunk: updateChunk, onBytes: trackSpeed() },
			);
			setReceipt({ shareUrl: shareUrl(result.shareLink.id), password });
			setPhase("success");
			announce({ tone: "success", message: "Transfer encrypted and uploaded." });
		} catch (err) {
			setPhase("staged");
			announce({ tone: "error", message: errorMessage(err) });
		}
	}

	async function copy(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			announce({ tone: "success", message: `${label} copied.` });
		} catch {
			announce({ tone: "error", message: "Could not access the clipboard." });
		}
	}

	function reset() {
		setStaged([]);
		setSettings(DEFAULT_ACCESS_SETTINGS);
		setChunkStates([]);
		setFingerprint(null);
		setReceipt(null);
		setSpeedMbps(0);
		setPhase("idle");
	}

	return {
		staged,
		totals,
		settings,
		setSettings,
		phase,
		locked,
		canSubmit,
		chunkStates,
		speedMbps,
		fingerprint,
		receipt,
		notice,
		addFiles,
		removeFile,
		submit,
		copy,
		reset,
	};
}
