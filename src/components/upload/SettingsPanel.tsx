import { NumberInput } from "@ark-ui/solid/number-input";
import { Select, createListCollection } from "@ark-ui/solid/select";
import { Switch } from "@ark-ui/solid/switch";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	ChevronsUpDownIcon,
	Lock,
	Settings,
} from "lucide-solid";
import { type Component, Index } from "solid-js";
import { Portal } from "solid-js/web";
import type { SecuritySettings } from "@/types/upload";

interface SettingsPanelProps {
	settings: SecuritySettings;
	onSettingsChange: (settings: SecuritySettings) => void;
	onUpload: () => void;
	disabled?: boolean;
	canUpload?: boolean;
}

const SettingsPanel: Component<SettingsPanelProps> = (props) => {
	const updateSetting = <K extends keyof SecuritySettings>(
		key: K,
		value: SecuritySettings[K],
	) => {
		props.onSettingsChange({ ...props.settings, [key]: value });
	};

	return (
		<div class="bg-card rounded-xl border border-border p-6 sticky top-24 shadow-sm">
			<h3 class="font-heading text-xl text-foreground mb-6 flex items-center gap-2.5">
				<Settings class="w-5 h-5 text-muted-foreground" />
				Security Settings
			</h3>

			<div class="flex flex-col gap-6">
				<ExpirationField
					value={props.settings.expiration}
					disabled={props.disabled}
					onChange={(v) => updateSetting("expiration", v)}
				/>

				<hr class="border-border/50" />

				<OneTimeDownloadField
					value={props.settings.oneTimeDownload}
					disabled={props.disabled}
					onChange={(v) => updateSetting("oneTimeDownload", v)}
				/>

				<hr class="border-border/50" />

				<MaxDownloadsField
					value={props.settings.maxDownloads}
					disabled={props.disabled}
					onChange={(v) => updateSetting("maxDownloads", v)}
				/>
			</div>

			<UploadAction
				onUpload={props.onUpload}
				disabled={props.disabled}
				canUpload={props.canUpload}
			/>
		</div>
	);
};

// ---- Internal field components ----

interface ExpirationFieldProps {
	value: string;
	disabled?: boolean;
	onChange: (value: string) => void;
}

const expirationOptions = createListCollection({
	items: [
		{ label: "24 Hours", value: "24h" },
		{ label: "7 Days", value: "7d" },
		{ label: "30 Days", value: "30d" },
		{ label: "Custom Date...", value: "custom" },
	],
});

const ExpirationField: Component<ExpirationFieldProps> = (props) => (
	<div>
		<Select.Root
			collection={expirationOptions}
			value={[props.value]}
			disabled={props.disabled}
			onValueChange={(details) => props.onChange(details.value[0])}
		>
			<Select.Label class="text-sm font-semibold text-foreground block mb-2">
				Expiration Time
			</Select.Label>
			<Select.Control class="relative">
				<Select.Trigger
					class="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground
                 focus:outline-none focus:ring-2 focus:ring-primary/20
                 focus:border-primary transition-colors cursor-pointer
                 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed
                 flex items-center justify-between"
					aria-label="Select expiration time"
				>
					<Select.ValueText placeholder="Select expiration" />
					<Select.Indicator>
						<ChevronsUpDownIcon class="w-4 h-4 text-muted-foreground" />
					</Select.Indicator>
				</Select.Trigger>
			</Select.Control>
			<Portal>
				<Select.Positioner>
					<Select.Content
						class="bg-muted border border-border rounded-lg shadow-lg p-1 z-50
                   min-w-[var(--reference-width)] max-h-60 overflow-y-auto"
					>
						<Index each={expirationOptions.items}>
							{(item) => (
								<Select.Item
									class="px-4 py-2 text-sm text-foreground rounded cursor-pointer
                         hover:bg-accent/50 data-[highlighted]:bg-accent/50
                         data-[state=checked]:text-primary flex items-center justify-between"
									item={item()}
								>
									<Select.ItemText>{item().label}</Select.ItemText>
									<Select.ItemIndicator class="text-primary">
										✓
									</Select.ItemIndicator>
								</Select.Item>
							)}
						</Index>
					</Select.Content>
				</Select.Positioner>
			</Portal>
			<Select.HiddenSelect />
		</Select.Root>
	</div>
);

interface OneTimeDownloadFieldProps {
	value: boolean;
	disabled?: boolean;
	onChange: (value: boolean) => void;
}

const OneTimeDownloadField: Component<OneTimeDownloadFieldProps> = (props) => (
	<Switch.Root
		checked={props.value}
		disabled={props.disabled}
		onCheckedChange={(details) => props.onChange(details.checked)}
		class="flex items-start justify-between gap-4 group"
	>
		<div class="flex-1">
			<Switch.Label
				class="text-sm font-semibold text-foreground cursor-pointer
             group-hover:text-primary transition-colors block"
			>
				One-Time Download
			</Switch.Label>
			<p class="text-xs text-muted-foreground mt-1 leading-relaxed">
				Destroys the file immediately after one view.
			</p>
		</div>
		<Switch.Control
			class="relative w-10 h-6 bg-muted rounded-full border border-border
             transition-colors duration-200 mt-0.5 shrink-0
             data-[state=checked]:bg-primary data-[state=checked]:border-primary
             data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
		>
			<Switch.Thumb
				class="absolute top-1 left-1 w-4 h-4 bg-muted-foreground rounded-full shadow-sm
               transition-transform duration-200
               data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground"
			/>
		</Switch.Control>
		<Switch.HiddenInput />
	</Switch.Root>
);

interface MaxDownloadsFieldProps {
	value: number | null;
	disabled?: boolean;
	onChange: (value: number | null) => void;
}

const MaxDownloadsField: Component<MaxDownloadsFieldProps> = (props) => (
	<div>
		<NumberInput.Root
			min={1}
			max={100}
			value={props.value?.toString() ?? ""}
			disabled={props.disabled}
			onValueChange={(details) => {
				const num = parseInt(details.value, 10);
				props.onChange(Number.isNaN(num) ? null : num);
			}}
			allowMouseWheel
			clampValueOnBlur
		>
			<NumberInput.Label class="text-sm font-semibold text-foreground block mb-2">
				Max Download Limit
			</NumberInput.Label>
			<NumberInput.Control class="relative">
				<NumberInput.Input
					class="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground
                 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                 transition-colors hover:border-primary/50
                 disabled:opacity-50 disabled:cursor-not-allowed"
					placeholder="Unlimited"
				/>
				<div class="absolute right-1 top-1 bottom-1 flex flex-col">
					<NumberInput.IncrementTrigger
						class="flex items-center justify-center w-6 h-full rounded
                   text-muted-foreground hover:text-foreground hover:bg-muted
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<ChevronUpIcon class="w-3.5 h-3.5" />
					</NumberInput.IncrementTrigger>
					<NumberInput.DecrementTrigger
						class="flex items-center justify-center w-6 h-full rounded
                   text-muted-foreground hover:text-foreground hover:bg-muted
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<ChevronDownIcon class="w-3.5 h-3.5" />
					</NumberInput.DecrementTrigger>
				</div>
			</NumberInput.Control>
		</NumberInput.Root>
		<p class="text-xs text-muted-foreground mt-2 text-right">
			Leave empty for unlimited within expiration.
		</p>
	</div>
);

interface UploadActionProps {
	onUpload: () => void;
	disabled?: boolean;
	canUpload?: boolean;
}

const UploadAction: Component<UploadActionProps> = (props) => (
	<div class="mt-8 pt-6 border-t border-border/50">
		<button
			class="w-full bg-primary text-primary-foreground py-3 rounded-lg text-sm font-semibold
             hover:bg-primary/90 transition-all flex items-center justify-center gap-2
             disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary
             relative overflow-hidden group shadow-sm hover:shadow-md
             active:scale-[0.98] transform duration-150"
			onClick={props.onUpload}
			disabled={props.disabled || !props.canUpload}
			title={!props.canUpload ? "Select a file first" : "Encrypt and upload"}
			aria-label="Start secure upload"
		>
			{/* Shimmer on hover */}
			<div
				class="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent
               -translate-x-full group-hover:translate-x-full
               transition-transform duration-1000 ease-in-out"
			/>
			<Lock class="w-4 h-4" />
			Start Secure Upload
		</button>
	</div>
);

export default SettingsPanel;
