import { AlertOctagon, ExternalLink } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";
import { resolveSafeRedirect } from "@/lib/safe-redirect";

const IAM_PROVIDER_ID = "share";

interface IamSignInButtonProps {
	redirect?: string;
}

export function IamSignInButton(props: IamSignInButtonProps) {
	const [pending, setPending] = createSignal(false);
	const [failed, setFailed] = createSignal(false);

	async function signIn() {
		setPending(true);
		setFailed(false);

		const { error } = await authClient.signIn.oauth2({
			providerId: IAM_PROVIDER_ID,
			callbackURL: resolveSafeRedirect(props.redirect, window.location.origin),
		});

		if (error) {
			setFailed(true);
			setPending(false);
		}
	}

	return (
		<div>
			<button
				type="button"
				onClick={signIn}
				disabled={pending()}
				class="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-sans text-base font-medium text-white transition-colors duration-(--duration-fast) hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70"
			>
				{pending() ? "Redirecting to IAM…" : "Continue with Digital Covet IAM"}
				<ExternalLink class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
			</button>

			<Show when={failed()}>
				<p
					role="alert"
					class="mt-3 flex items-start gap-2 rounded-md bg-status-error-tint p-3 text-xs text-status-error"
				>
					<AlertOctagon class="mt-px size-3.5 shrink-0" stroke-width={1.75} aria-hidden="true" />
					<span>
						<span class="font-medium tracking-[0.12em]">ERROR</span> — Could not
						reach Digital Covet IAM. Please try again.
					</span>
				</p>
			</Show>

			<p class="mt-4 text-center text-[11px] text-text-muted">
				Delegated OpenID Connect authentication via Better Auth.
			</p>
		</div>
	);
}
