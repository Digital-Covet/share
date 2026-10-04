import { Meta, Title } from "@solidjs/meta";
import { Show } from "solid-js";
import { ChunkMatrix } from "@/components/crypto/ChunkMatrix";
import { NoticeBanner } from "@/components/dashboard/NoticeBanner";
import { AppShell } from "@/components/shell/AppShell";
import { SecuritySettingsCard } from "@/components/upload/SecuritySettingsCard";
import { ShareLinkReceiptCard } from "@/components/upload/ShareLinkReceiptCard";
import { StagingCard } from "@/components/upload/StagingCard";
import { pageMetadata } from "@/lib/seo";
import { useUploadEngine } from "@/lib/upload/use-upload-engine";

export default function Upload() {
	const engine = useUploadEngine();
	const showPipeline = () => engine.phase() === "encrypting" || engine.phase() === "success";

	return (
		<>
			<Title>{pageMetadata.upload.title}</Title>
			<Meta name="description" content={pageMetadata.upload.description} />
			<AppShell>
				<header>
					<h1 class="font-display text-[31px] leading-tight font-extrabold tracking-[-0.02em] text-text-main">
						Encrypt &amp; Send Files
					</h1>
					<p class="mt-1 text-text-muted">
						Client-side AES-256-GCM encryption with direct-to-R2 streaming.
					</p>
				</header>

				<div class="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
					<div class="space-y-6 lg:col-span-7">
						<StagingCard
							files={engine.staged()}
							totals={engine.totals()}
							fingerprint={engine.fingerprint()}
							locked={engine.locked()}
							onFiles={engine.addFiles}
							onRemove={engine.removeFile}
						/>
						<Show when={showPipeline()}>
							<ChunkMatrix
								totalChunks={engine.chunkStates().length}
								chunkStates={engine.chunkStates()}
								currentSpeedMbps={engine.speedMbps()}
								fileName={engine.totals().outputName}
							/>
						</Show>
					</div>

					<div class="space-y-6 lg:col-span-5">
						<SecuritySettingsCard
							settings={engine.settings()}
							locked={engine.locked()}
							canSubmit={engine.canSubmit()}
							encrypting={engine.phase() === "encrypting"}
							onChange={engine.setSettings}
							onSubmit={engine.submit}
						/>
						<Show when={engine.receipt()}>
							{(receipt) => (
								<ShareLinkReceiptCard
									receipt={receipt()}
									onCopy={engine.copy}
									onReset={engine.reset}
								/>
							)}
						</Show>
					</div>
				</div>
				<NoticeBanner notice={engine.notice()} />
			</AppShell>
		</>
	);
}
