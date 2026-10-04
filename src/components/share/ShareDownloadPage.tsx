import { Download } from "lucide-solid";
import { createResource, createSignal, Match, onCleanup, Show, Switch } from "solid-js";
import { KeyFingerprint } from "@/components/crypto/KeyFingerprint";
import { PRIMARY_BUTTON } from "@/components/ui/button-styles";
import { supportsFileSystemAccess } from "@/lib/download/stream-to-disk";
import { fingerprintKey } from "@/lib/share/fingerprint";
import { saveTransfer } from "@/lib/share/save-transfer";
import { useDecryptProgress } from "@/lib/share/use-decrypt-progress";
import { useShareTransfer } from "@/lib/share/use-share-transfer";
import type { ShareTransfer } from "@/types/share";
import { DecryptionComplete } from "./DecryptionComplete";
import { DecryptionProgress } from "./DecryptionProgress";
import { DownloadVault } from "./DownloadVault";
import { FileSummaryBox } from "./FileSummaryBox";
import { PasswordChallengeForm } from "./PasswordChallengeForm";
import { TransferTombstone } from "./TransferTombstone";

const LARGE_FILE_BYTES = 500 * 1024 * 1024;
const CLOCK_TICK_MS = 30_000;

interface ShareDownloadPageProps {
	shareLinkId: string;
}

function BufferedDownloadNotice(props: { transfer: ShareTransfer }) {
	const show = () => !supportsFileSystemAccess() && props.transfer.sizeBytes > LARGE_FILE_BYTES;

	return (
		<Show when={show()}>
			<p class="mb-4 rounded-md border border-border-subtle bg-surface-subtle p-3 text-xs text-text-muted" role="note">
				This browser must hold the whole file in memory while decrypting. For files this large, use a
				desktop browser such as Chrome or Edge.
			</p>
		</Show>
	);
}

export function ShareDownloadPage(props: ShareDownloadPageProps) {
	const share = useShareTransfer(props.shareLinkId);
	const progress = useDecryptProgress();
	const [saveError, setSaveError] = createSignal("");
	const [now, setNow] = createSignal(Date.now());
	const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
	onCleanup(() => clearInterval(clock));

	const [fingerprint] = createResource(
		() => share.transfer()?.keyBase64Url,
		(key) => fingerprintKey(key),
	);

	async function handleSave(transfer: ShareTransfer) {
		setSaveError("");
		progress.reset(transfer.totalChunks);
		share.setPhase("downloading");

		try {
			const outcome = await saveTransfer({
				transfer,
				password: share.password(),
				onProgress: progress.onProgress,
			});
			share.setPhase(outcome === "saved" ? "complete" : "ready");
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : "Download failed.");
			share.setPhase("ready");
		}
	}

	return (
		<main class="flex min-h-screen items-center justify-center bg-background p-4">
			<Switch>
				<Match when={share.phase() === "unavailable"}>
					<TransferTombstone shareLinkId={props.shareLinkId} reason={share.reason()} />
				</Match>
				<Match when={share.phase() === "error"}>
					<DownloadVault>
						<p class="text-sm text-status-error" role="alert">
							{share.errorMessage()}
						</p>
					</DownloadVault>
				</Match>
				<Match when={true}>
					<DownloadVault>
						<Switch>
							<Match when={share.phase() === "loading"}>
								<p class="text-sm text-text-muted" role="status">
									Verifying transfer…
								</p>
							</Match>
							<Match when={share.phase() === "password"}>
								<PasswordChallengeForm
									failures={share.passwordFailures()}
									busy={share.unlocking()}
									onSubmit={share.unlock}
								/>
							</Match>
							<Match when={share.transfer()}>
								{(transfer) => (
									<div class="share-fade-in">
										<FileSummaryBox transfer={transfer()} now={now()} />
										<Switch>
											<Match when={share.phase() === "downloading"}>
												<DecryptionProgress
													fileName={transfer().fileName}
													chunkStates={progress.chunkStates()}
													activeChunk={progress.activeChunk()}
													speedMbps={progress.speedMbps()}
												/>
											</Match>
											<Match when={share.phase() === "complete"}>
												<DecryptionComplete />
											</Match>
											<Match when={share.phase() === "ready"}>
												<BufferedDownloadNotice transfer={transfer()} />
												<Show when={saveError()}>
													<p class="mb-3 text-sm text-status-error" role="alert">
														{saveError()}
													</p>
												</Show>
												<div class="mb-3 flex justify-end">
													<KeyFingerprint digest={fingerprint() ?? null} />
												</div>
												<button
													type="button"
													class={`${PRIMARY_BUTTON} w-full`}
													onClick={() => void handleSave(transfer())}
												>
													<Download class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
													Save to Disk
												</button>
											</Match>
										</Switch>
									</div>
								)}
							</Match>
						</Switch>
					</DownloadVault>
				</Match>
			</Switch>
		</main>
	);
}
