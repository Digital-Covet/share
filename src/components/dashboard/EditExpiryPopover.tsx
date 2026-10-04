import { Popover } from "@ark-ui/solid/popover";
import { Clock } from "lucide-solid";
import { createSignal, For } from "solid-js";
import { Portal } from "solid-js/web";
import type { FileItem } from "@/types/dashboard";

const DAY_MS = 24 * 60 * 60 * 1000;

const EXPIRY_PRESETS = [
	{ label: "24 Hours", durationMs: DAY_MS },
	{ label: "7 Days", durationMs: 7 * DAY_MS },
	{ label: "30 Days", durationMs: 30 * DAY_MS },
] as const;

interface EditExpiryPopoverProps {
	file: FileItem;
	onSave: (file: FileItem, expiresAt: number) => Promise<void>;
}

export function EditExpiryPopover(props: EditExpiryPopoverProps) {
	const [open, setOpen] = createSignal(false);
	const [pending, setPending] = createSignal(false);

	async function apply(durationMs: number) {
		setPending(true);
		try {
			await props.onSave(props.file, Date.now() + durationMs);
			setOpen(false);
		} finally {
			setPending(false);
		}
	}

	return (
		<Popover.Root open={open()} onOpenChange={(e) => setOpen(e.open)}>
			<Popover.Trigger
				aria-label={`Edit expiry for ${props.file.name}`}
				class="flex size-9 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle hover:text-text-main focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
			>
				<Clock class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
			</Popover.Trigger>
			<Portal>
				<Popover.Positioner>
					<Popover.Content class="z-50 w-56 rounded-md border border-border-strong bg-surface p-3 shadow-[0_10px_25px_-5px_var(--dc-shadow)]">
						<Popover.Title class="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
							Extend from now
						</Popover.Title>
						<div class="flex flex-col gap-1">
							<For each={EXPIRY_PRESETS}>
								{(preset) => (
									<button
										type="button"
										disabled={pending()}
										onClick={() => apply(preset.durationMs)}
										class="min-h-[44px] cursor-pointer rounded-sm px-3 text-left text-sm text-text-main hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
									>
										{preset.label}
									</button>
								)}
							</For>
						</div>
					</Popover.Content>
				</Popover.Positioner>
			</Portal>
		</Popover.Root>
	);
}
