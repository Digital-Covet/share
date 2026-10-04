import { NumberInput } from "@ark-ui/solid/number-input";
import { Minus, Plus } from "lucide-solid";
import {
	DOWNLOAD_LIMIT_MAX,
	DOWNLOAD_LIMIT_MIN,
} from "@/lib/upload/access-settings";
import type { AccessSettings } from "@/types/upload";

const STEP_BUTTON =
	"flex size-11 cursor-pointer items-center justify-center text-text-muted hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";

interface DownloadLimitFieldProps {
	settings: AccessSettings;
	disabled: boolean;
	onChange: (next: AccessSettings) => void;
}

export function DownloadLimitField(props: DownloadLimitFieldProps) {
	const unlimited = () => props.settings.downloadLimit === null;

	return (
		<div class="space-y-2">
			<NumberInput.Root
				value={String(props.settings.downloadLimit ?? DOWNLOAD_LIMIT_MIN)}
				min={DOWNLOAD_LIMIT_MIN}
				max={DOWNLOAD_LIMIT_MAX}
				disabled={props.disabled || unlimited()}
				onValueChange={(e) => {
					if (!Number.isNaN(e.valueAsNumber)) {
						props.onChange({ ...props.settings, downloadLimit: e.valueAsNumber });
					}
				}}
			>
				<NumberInput.Label class="mb-2 block text-sm font-medium text-text-main">
					Download limit
				</NumberInput.Label>
				<NumberInput.Control class="flex w-full items-center overflow-hidden rounded-md border border-border bg-surface">
					<NumberInput.DecrementTrigger class={STEP_BUTTON} aria-label="Decrease limit">
						<Minus class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
					</NumberInput.DecrementTrigger>
					<NumberInput.Input class="min-h-[44px] w-full min-w-0 bg-transparent text-center font-mono text-sm text-text-main tabular-nums focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50" />
					<NumberInput.IncrementTrigger class={STEP_BUTTON} aria-label="Increase limit">
						<Plus class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
					</NumberInput.IncrementTrigger>
				</NumberInput.Control>
			</NumberInput.Root>
			<label class="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-text-main">
				<input
					type="checkbox"
					checked={unlimited()}
					disabled={props.disabled}
					onChange={(e) =>
						props.onChange({
							...props.settings,
							downloadLimit: e.currentTarget.checked ? null : DOWNLOAD_LIMIT_MIN,
						})
					}
					class="size-4 accent-primary"
				/>
				Unlimited downloads
			</label>
		</div>
	);
}
