import { useSearchParams } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { createSignal, onMount, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";
import { APP_DOMAIN, ROUTES } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

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

			const response = await authClient.signIn.oauth2({
				providerId: "share",
				callbackURL,
			});

			if (response.error) {
				setError(
					response.error.message ??
						"Unable to sign in. Please try again or contact support.",
				);
				setIsRedirecting(false);
			}
		} catch {
			setError("An unexpected error occurred. Please try again.");
			setIsRedirecting(false);
		}
	});

	const handleRetry = async () => {
		setError(null);
		setIsRedirecting(true);

		const rawRedirect = searchParams.redirect;
		const redirectParam = Array.isArray(rawRedirect)
			? rawRedirect[0]
			: rawRedirect;
		const callbackURL = resolveCallbackUrl(redirectParam);

		try {
			const response = await authClient.signIn.oauth2({
				providerId: "share",
				callbackURL,
			});

			if (response.error) {
				setError(
					response.error.message ??
						"Unable to sign in. Please try again or contact support.",
				);
				setIsRedirecting(false);
			}
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
								<button
									type="button"
									onClick={handleRetry}
									class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
								>
									Try again
								</button>
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
