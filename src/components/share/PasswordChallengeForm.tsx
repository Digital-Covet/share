import { KeyRound } from "lucide-solid";
import { createEffect, createSignal, on, Show } from "solid-js";
import { PRIMARY_BUTTON, TEXT_INPUT } from "@/components/ui/button-styles";

interface PasswordChallengeFormProps {
	failures: number;
	busy: boolean;
	onSubmit: (password: string) => void;
}

export function PasswordChallengeForm(props: PasswordChallengeFormProps) {
	const [value, setValue] = createSignal("");
	let input: HTMLInputElement | undefined;

	// Removing and re-adding the class (with a reflow between) replays the animation on every wrong attempt.
	createEffect(
		on(
			() => props.failures,
			(failures) => {
				if (!failures || !input) return;
				input.classList.remove("vault-shake");
				void input.offsetWidth;
				input.classList.add("vault-shake");
				input.select();
			},
			{ defer: true },
		),
	);

	return (
		<form
			class="space-y-3"
			onSubmit={(event) => {
				event.preventDefault();
				if (value()) props.onSubmit(value());
			}}
		>
			<label class="block text-sm font-medium text-text-main" for="share-passphrase">
				Decryption Passphrase Required
			</label>
			<input
				ref={input}
				id="share-passphrase"
				type="password"
				autocomplete="off"
				maxlength="128"
				// biome-ignore lint/a11y/noAutofocus: the passphrase is the only action on this screen
				autofocus
				value={value()}
				onInput={(event) => setValue(event.currentTarget.value)}
				placeholder="Enter secret passphrase"
				aria-invalid={props.failures > 0 ? "true" : undefined}
				aria-describedby={props.failures > 0 ? "share-passphrase-error" : undefined}
				class={`${TEXT_INPUT} ${props.failures > 0 ? "border-status-error" : ""}`}
			/>
			<Show when={props.failures > 0}>
				<p id="share-passphrase-error" class="text-xs font-medium text-status-error" role="alert">
					Decryption failed. Invalid passphrase.
				</p>
			</Show>
			<button type="submit" class={`${PRIMARY_BUTTON} w-full`} disabled={props.busy || !value()}>
				<KeyRound class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
				Unlock &amp; Verify Cipher
			</button>
		</form>
	);
}
