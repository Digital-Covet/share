import { SegmentGroup } from "@ark-ui/solid/segment-group";
import { For, Show } from "solid-js";
import { TEXT_INPUT } from "@/components/ui/button-styles";
import type { AccessSettings, ExpirationPreset } from "@/types/upload";

const SEGMENTS: ReadonlyArray<{ value: ExpirationPreset; label: string }> = [
	{ value: "24h", label: "24 Hours" },
	{ value: "7d", label: "7 Days" },
	{ value: "30d", label: "30 Days" },
	{ value: "custom", label: "Custom" },
];

interface FieldProps {
	settings: AccessSettings;
	disabled: boolean;
	onChange: (next: AccessSettings) => void;
}

export function ExpiryField(props: FieldProps) {
	return (
		<fieldset class="space-y-2" disabled={props.disabled}>
			<legend class="mb-2 text-sm font-medium text-text-main">Link expires after</legend>
			<SegmentGroup.Root
				value={props.settings.expiration}
				onValueChange={(e) =>
					e.value &&
					props.onChange({ ...props.settings, expiration: e.value as ExpirationPreset })
				}
				class="relative inline-flex w-full rounded-md border border-border bg-surface p-0.5"
			>
				<SegmentGroup.Indicator
					class="absolute rounded-sm bg-secondary"
					style={{
						width: "var(--width)",
						height: "var(--height)",
						left: "var(--left)",
						top: "var(--top)",
					}}
				/>
				<For each={SEGMENTS}>
					{(segment) => (
						<SegmentGroup.Item
							value={segment.value}
							class="relative z-10 flex min-h-[40px] flex-1 cursor-pointer items-center justify-center px-2 text-sm font-medium text-text-muted transition-colors duration-(--duration-fast) data-[state=checked]:text-text-inverse"
						>
							<SegmentGroup.ItemText>{segment.label}</SegmentGroup.ItemText>
							<SegmentGroup.ItemControl />
							<SegmentGroup.ItemHiddenInput />
						</SegmentGroup.Item>
					)}
				</For>
			</SegmentGroup.Root>
			<Show when={props.settings.expiration === "custom"}>
				<label class="block">
					<span class="sr-only">Custom expiry date and time</span>
					<input
						type="datetime-local"
						value={props.settings.customExpiration}
						onInput={(e) =>
							props.onChange({ ...props.settings, customExpiration: e.currentTarget.value })
						}
						class={TEXT_INPUT}
					/>
				</label>
			</Show>
		</fieldset>
	);
}
