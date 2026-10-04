import { Dialog } from "@ark-ui/solid/dialog";
import { AlertOctagon, Trash2, X } from "lucide-solid";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { FileItem } from "@/types/dashboard";

interface RevokeDialogProps {
	file: FileItem | null;
	pending: boolean;
	onConfirm: (file: FileItem) => void;
	onClose: () => void;
}

export function RevokeDialog(props: RevokeDialogProps) {
	return (
		<Dialog.Root
			open={props.file !== null}
			onOpenChange={(e) => !e.open && props.onClose()}
			role="alertdialog"
		>
			<Portal>
				<Dialog.Backdrop class="fixed inset-0 z-40 bg-secondary/40" />
				<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
					<Show when={props.file}>
						{(file) => (
							<Dialog.Content
								class="vault-notch-frame w-full max-w-md"
								style={{ "--notch": "12px" }}
							>
								<div class="vault-notch relative border border-border-subtle bg-surface p-6">
									<span
										class="vault-notch-tick pointer-events-none absolute top-0 right-0"
										aria-hidden="true"
									/>
									<Dialog.CloseTrigger
										class="absolute top-4 right-6 flex size-8 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent"
										aria-label="Close"
									>
										<X class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
									</Dialog.CloseTrigger>

									<div class="mb-4 flex size-10 items-center justify-center rounded-full bg-status-error-tint text-status-error">
										<AlertOctagon class="size-5" stroke-width={1.75} aria-hidden="true" />
									</div>
									<Dialog.Title class="font-display text-[25px] leading-tight font-bold tracking-[-0.01em] text-text-main">
										Revoke this transfer?
									</Dialog.Title>
									<Dialog.Description class="mt-2 text-sm text-text-muted">
										<span class="font-medium text-text-main">{file().name}</span>{" "}
										will be permanently purged from storage and its share link
										will stop working immediately. This cannot be undone.
									</Dialog.Description>

									<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
										<Dialog.CloseTrigger class="min-h-[44px] cursor-pointer rounded-md border border-border px-4 text-sm font-medium text-text-main hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent">
											Cancel
										</Dialog.CloseTrigger>
										<button
											type="button"
											disabled={props.pending}
											onClick={() => props.onConfirm(file())}
											class="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70"
										>
											<Trash2 class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
											{props.pending ? "Revoking…" : "Revoke Now"}
										</button>
									</div>
								</div>
							</Dialog.Content>
						)}
					</Show>
				</Dialog.Positioner>
			</Portal>
		</Dialog.Root>
	);
}
