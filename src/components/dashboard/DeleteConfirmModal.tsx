import { AlertTriangle, X } from "lucide-solid";
import { Show } from "solid-js";
import type { FileItem } from "@/types/dashboard";
import { Button } from "../ui/button";

interface DeleteConfirmModalProps {
	file: FileItem | null;
	isOpen: boolean;
	onClose: () => void;
	onConfirm: (fileId: string) => void;
}

export function DeleteConfirmModal(props: DeleteConfirmModalProps) {
	return (
		<Show when={props.isOpen && props.file}>
			<div
				class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn"
				role="dialog"
				aria-modal="true"
			>
				<div class="bg-surface-container-low border border-outline-variant w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-scaleIn">
					{/* Header */}
					<div class="flex items-center justify-between p-5 border-b border-outline-variant/50">
						<h3 class="text-lg font-bold font-heading text-on-surface flex items-center gap-2">
							<AlertTriangle size={18} class="text-error" />
							Revoke Transfer Link
						</h3>
						<button
							onClick={() => props.onClose()}
							class="text-on-surface-variant hover:text-on-surface p-1 rounded-full transition-colors"
							aria-label="Close dialog"
						>
							<X size={18} />
						</button>
					</div>

					{/* Content */}
					<div class="p-5 flex flex-col gap-3">
						<p class="text-sm text-on-surface-variant">
							Are you sure you want to revoke and delete the secure transfer
							link for:
						</p>
						<div class="bg-background border border-outline-variant/50 p-3 rounded-lg">
							<p class="text-sm font-semibold text-on-surface truncate">
								{props.file?.name}
							</p>
							<p class="text-xs text-on-surface-variant mt-1">
								Size: {props.file?.sizeFormatted} | Downloads:{" "}
								{props.file?.downloads}
							</p>
						</div>
						<p class="text-xs text-error font-medium flex items-center gap-1.5 mt-1">
							<span>⚠</span> This action cannot be undone. Anyone with this link
							will immediately lose access.
						</p>
					</div>

					{/* Actions */}
					<div class="p-5 border-t border-outline-variant/50 bg-surface-container-lowest flex justify-end gap-3">
						<Button variant="ghost" onClick={() => props.onClose()}>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={() => {
								if (props.file) {
									props.onConfirm(props.file.id);
									props.onClose();
								}
							}}
						>
							Confirm Revocation
						</Button>
					</div>
				</div>
			</div>
		</Show>
	);
}
