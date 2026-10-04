import { createSignal, onMount } from "solid-js";
import { type FileMetaResponse, fetchFileMeta } from "@/lib/api/meta";
import { base64UrlToBuffer } from "@/lib/crypto";
import type { ShareTransfer, SharePhase, UnavailableReason } from "@/types/share";

const HTTP_UNAUTHORIZED = 401;
const HTTP_GONE = 410;
const HTTP_NOT_FOUND = 404;

function toTransfer(meta: FileMetaResponse): ShareTransfer | null {
	if (!meta.encryptionKey || !meta.ivBase) return null;
	return {
		fileId: meta.fileId,
		fileName: meta.originalName,
		mimeType: meta.mimeType,
		sizeBytes: Number(meta.originalSize),
		chunkSize: meta.chunkSize,
		totalChunks: meta.totalChunks,
		keyBase64Url: meta.encryptionKey,
		ivBase: new Uint8Array(base64UrlToBuffer(meta.ivBase)),
		expiresAt: meta.expiresAt ? Date.parse(meta.expiresAt) : null,
		remainingDownloads:
			meta.maxDownloads === undefined ? null : Math.max(0, meta.maxDownloads - meta.downloadCount),
	};
}

export function useShareTransfer(shareLinkId: string) {
	const [phase, setPhase] = createSignal<SharePhase>("loading");
	const [transfer, setTransfer] = createSignal<ShareTransfer>();
	const [reason, setReason] = createSignal<UnavailableReason>("not_found");
	const [errorMessage, setErrorMessage] = createSignal("");
	const [passwordFailures, setPasswordFailures] = createSignal(0);
	const [unlocking, setUnlocking] = createSignal(false);
	let verifiedPassword = "";

	async function resolve(password: string) {
		const result = await fetchFileMeta(shareLinkId, password);

		if (result.ok && result.data) {
			const next = toTransfer(result.data);
			if (!next) {
				setErrorMessage("This link is missing its key material.");
				setPhase("error");
				return;
			}
			verifiedPassword = password;
			setTransfer(next);
			setPhase("ready");
			return;
		}

		if (result.status === HTTP_UNAUTHORIZED) {
			if (password) setPasswordFailures((count) => count + 1);
			setPhase("password");
			return;
		}

		if (result.status === HTTP_GONE || result.status === HTTP_NOT_FOUND) {
			setReason(result.reason ?? "not_found");
			setPhase("unavailable");
			return;
		}

		setErrorMessage(result.error ?? "Something went wrong.");
		setPhase("error");
	}

	async function unlock(password: string) {
		setUnlocking(true);
		try {
			await resolve(password);
		} catch {
			setErrorMessage("Network error. Check your connection and try again.");
			setPhase("error");
		} finally {
			setUnlocking(false);
		}
	}

	onMount(() => void unlock(""));

	return {
		phase,
		setPhase,
		transfer,
		reason,
		errorMessage,
		passwordFailures,
		unlocking,
		unlock,
		password: () => verifiedPassword,
	};
}
