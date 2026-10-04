import { Switch } from "@ark-ui/solid/switch";
import { Show } from "solid-js";
import { TEXT_INPUT } from "@/components/ui/button-styles";
import type { AccessSettings } from "@/types/upload";

interface PassphraseFieldProps {
	settings: AccessSettings;
	disabled: boolean;
	onChange: (next: AccessSettings) => void;
}

export function PassphraseField(props: PassphraseFieldProps) {
	const setPassword = (patch: Partial<AccessSettings["password"]>) =>
		props.onChange({
			...props.settings,
			password: { ...props.settings.password, ...patch },
		});

	return (
		<div class="space-y-3">
			<Switch.Root
				checked={props.settings.password.enabled}
				disabled={props.disabled}
				onCheckedChange={(e) => setPassword({ enabled: e.checked })}
				class="flex min-h-[44px] cursor-pointer items-center justify-between gap-3"
			>
				<Switch.Label class="text-sm font-medium text-text-main">Require Passphrase</Switch.Label>
				<Switch.Control class="relative inline-flex h-6 w-11 items-center rounded-full bg-border-strong/40 transition-colors duration-(--duration-fast) data-[state=checked]:bg-primary data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent">
					<Switch.Thumb class="size-5 translate-x-0.5 rounded-full bg-surface shadow-xs transition-transform duration-(--duration-fast) data-[state=checked]:translate-x-[22px]" />
				</Switch.Control>
				<Switch.HiddenInput />
			</Switch.Root>
			<Show when={props.settings.password.enabled}>
				<label class="block">
					<span class="sr-only">Passphrase</span>
					<input
						type="password"
						autocomplete="new-password"
						maxlength="128"
						value={props.settings.password.value}
						disabled={props.disabled}
						onInput={(e) => setPassword({ value: e.currentTarget.value })}
						placeholder="Enter high-entropy passphrase"
						class={TEXT_INPUT}
					/>
				</label>
				<p class="text-xs text-text-muted">
					Passphrase is protected with PBKDF2 (600,000 rounds, SHA-256).
				</p>
			</Show>
		</div>
	);
}
