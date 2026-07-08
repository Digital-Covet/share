import { useSearchParams } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";
import { APP_DOMAIN, ROUTES } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

const DEFAULT_RETRY_AFTER = 10;

function resolveCallbackUrl(rawRedirect: string | undefined): string {
	if (rawRedirect) {
		try {
			const url = new URL(rawRedirect);
			if (url.origin === new URL(APP_DOMAIN).origin) {
				return url.href;
			}
		} catch {
			// Fall through to default dashboard URL.
		}
	}

	return `${APP_DOMAIN.replace(/\/+$/, "")}${ROUTES.DASHBOARD}`;
}

export default function LoginPage() {
	const [searchParams] = useSearchParams();
	const [error, setError] = createSignal<string | null>(null);
	const [isRedirecting, setIsRedirecting] = createSignal(true);
	const [retryAfter, setRetryAfter] = createSignal(0);

	let countdownTimer: ReturnType<typeof setInterval> | undefined;

	const startCountdown = (seconds: number) => {
		setRetryAfter(seconds);
		clearInterval(countdownTimer);
		countdownTimer = setInterval(() => {
			setRetryAfter((prev) => {
				if (prev <= 1) {
					clearInterval(countdownTimer);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
	};

	onCleanup(() => clearInterval(countdownTimer));

	const attemptSignIn = async (callbackURL: string) => {
		const response = await authClient.signIn.oauth2({
			providerId: "share",
			callbackURL,
		});

		if (response.error) {
			const msg = response.error.message ?? "Unable to sign in.";
			const status = (response.error as { status?: number }).status;

			if (status === 429) {
				startCountdown(DEFAULT_RETRY_AFTER);
				setError("Rate limited. Please wait before retrying.");
			} else {
				setError(msg);
			}
			setIsRedirecting(false);
			return;
		}
	};

	onMount(async () => {
		const rawRedirect = searchParams.redirect;
		const redirectParam = Array.isArray(rawRedirect)
			? rawRedirect[0]
			: rawRedirect;
		const callbackURL = resolveCallbackUrl(redirectParam);

		try {
			const session = await authClient.getSession();
			if (session.data?.session) {
				window.location.replace(callbackURL);
				return;
			}

			await attemptSignIn(callbackURL);
		} catch {
			setError("An unexpected error occurred. Please try again.");
			setIsRedirecting(false);
		}
	});

	const handleRetry = async () => {
		if (retryAfter() > 0) return;

		setError(null);
		setIsRedirecting(true);

		const rawRedirect = searchParams.redirect;
		const redirectParam = Array.isArray(rawRedirect)
			? rawRedirect[0]
			: rawRedirect;
		const callbackURL = resolveCallbackUrl(redirectParam);

		try {
			await attemptSignIn(callbackURL);
		} catch {
			setError("An unexpected error occurred. Please try again.");
			setIsRedirecting(false);
		}
	};

	return (
		<>
			<Title>{pageMetadata.login.title}</Title>
			<Meta name="description" content={pageMetadata.login.description} />
			<main class="h-screen w-screen flex items-center justify-center">
				<div class="w-full max-w-md space-y-6 p-8 text-center">
					<h1 class="text-2xl font-semibold">Sign in</h1>
					<Show
						when={isRedirecting()}
						fallback={
							<div class="space-y-4">
								<Show when={error()}>
									<p class="text-sm text-red-600">{error()}</p>
								</Show>
								<Show
									when={retryAfter() > 0}
									fallback={
										<button
											type="button"
											onClick={handleRetry}
											class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
										>
											Try again
										</button>
									}
								>
									<p class="text-sm text-muted-foreground">
										Retry in {retryAfter()}s...
									</p>
								</Show>
							</div>
						}
					>
						<p class="text-sm text-muted-foreground">
							Redirecting to iam.digitalcovet.com to authenticate...
						</p>
					</Show>
				</div>
			</main>
		</>
	);
}
