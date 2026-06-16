import { Calendar, X } from "lucide-solid";
import { createEffect, createSignal, Show } from "solid-js";
import type { FileItem } from "@/types/dashboard";
import { Button } from "../ui/button";

interface EditExpiryModalProps {
	file: FileItem | null;
	isOpen: boolean;
	onClose: () => void;
	onSave: (
		fileId: string,
		newExpiryDisplay: string,
		newTimestamp: number,
	) => void;
}

export function EditExpiryModal(props: EditExpiryModalProps) {
	const [expiryOption, setExpiryOption] = createSignal<
		"date" | "never" | "upon-dl"
	>("date");
	const [customDate, setCustomDate] = createSignal("");

	// When the modal opens, pre-populate if possible
	createEffect(() => {
		if (props.file) {
			const display = props.file.expiryDisplay;
			if (display === "Never") {
				setExpiryOption("never");
			} else if (display === "Upon DL") {
				setExpiryOption("upon-dl");
			} else {
				setExpiryOption("date");
				// Parse the existing date string if possible, or leave empty
				try {
					const date = new Date(display);
					if (!isNaN(date.getTime())) {
						setCustomDate(date.toISOString().split("T")[0]);
					}
				} catch {
					setCustomDate("");
				}
			}
		}
	});

	const handleSave = () => {
		if (!props.file) return;

		let display = "Never";
		let timestamp = 3000000000000;

		if (expiryOption() === "never") {
			display = "Never";
			timestamp = 3000000000000;
		} else if (expiryOption() === "upon-dl") {
			display = "Upon DL";
			timestamp = 2000000000000;
		} else {
			if (!customDate()) {
				alert("Please select a valid expiry date.");
				return;
			}
			const selectedDate = new Date(customDate());
			timestamp = selectedDate.getTime();

			// Format as "MMM DD, YYYY"
			display = selectedDate.toLocaleDateString("en-US", {
				month: "short",
				day: "2-digit",
				year: "numeric",
			});
		}

		props.onSave(props.file.id, display, timestamp);
		props.onClose();
	};

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
							<Calendar size={18} class="text-primary" />
							Edit Expiry Date
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
					<div class="p-5 flex flex-col gap-4">
						<div>
							<label class="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
								File Name
							</label>
							<p class="text-sm font-medium text-on-surface truncate mt-0.5">
								{props.file?.name}
							</p>
						</div>

						<div>
							<label class="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold block mb-2">
								Expiry Policy
							</label>
							<div class="grid grid-cols-3 gap-2">
								<button
									type="button"
									onClick={() => setExpiryOption("date")}
									class={`py-2 px-3 text-xs font-medium border rounded-lg transition-colors ${
										expiryOption() === "date"
											? "bg-primary/10 text-primary border-primary"
											: "border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface"
									}`}
								>
									Custom Date
								</button>
								<button
									type="button"
									onClick={() => setExpiryOption("never")}
									class={`py-2 px-3 text-xs font-medium border rounded-lg transition-colors ${
										expiryOption() === "never"
											? "bg-primary/10 text-primary border-primary"
											: "border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface"
									}`}
								>
									Never Expire
								</button>
								<button
									type="button"
									onClick={() => setExpiryOption("upon-dl")}
									class={`py-2 px-3 text-xs font-medium border rounded-lg transition-colors ${
										expiryOption() === "upon-dl"
											? "bg-primary/10 text-primary border-primary"
											: "border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface"
									}`}
								>
									One-time DL
								</button>
							</div>
						</div>

						<Show when={expiryOption() === "date"}>
							<div class="animate-fadeIn">
								<label class="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold block mb-1.5">
									Select Expiry Date
								</label>
								<input
									type="date"
									value={customDate()}
									onInput={(e) => setCustomDate(e.currentTarget.value)}
									class="w-full bg-background border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
								/>
							</div>
						</Show>
					</div>

					{/* Actions */}
					<div class="p-5 border-t border-outline-variant/50 bg-surface-container-lowest flex justify-end gap-3">
						<Button variant="ghost" onClick={() => props.onClose()}>
							Cancel
						</Button>
						<Button variant="primary" onClick={handleSave}>
							Save Changes
						</Button>
					</div>
				</div>
			</div>
		</Show>
	);
}
