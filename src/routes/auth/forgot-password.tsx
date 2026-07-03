import { A } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { ArrowLeft, Mail, X } from "lucide-solid";
import { createSignal, type JSX, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";
import { pageMetadata } from "@/lib/seo";

export default function ForgotPasswordForm() {
  const [email, setEmail] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [submitted, setSubmitted] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
    e,
  ) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await authClient.requestPasswordReset({
        email: email(),
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (response.error) {
        throw new Error(response.error.message ?? "Failed to send reset link");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send reset link";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main class="h-screen w-screen flex items-center justify-center">
      <Title>{pageMetadata.forgotPassword.title}</Title>
      <Meta
        name="description"
        content={pageMetadata.forgotPassword.description}
      />
      <div class="max-w-md p-8 mx-auto bg-card text-card-foreground rounded-xl shadow-md">
        <div class="text-center">
          <h1 class="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground font-heading">
            {submitted() ? "Check your email" : "Forgot your password?"}
          </h1>
          <p class="text-base mt-4 text-muted-foreground text-balance">
            {submitted()
              ? "We've sent a password reset link to your email address."
              : "No worries. Enter the email tied to your account and we'll send you a link to reset it."}
          </p>
        </div>
        <Show when={!submitted()}>
          <form class="mt-10 space-y-4" onSubmit={handleSubmit}>
            <Show when={error()}>
              <div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                {error()}
              </div>
            </Show>
            <div class="w-full" required disabled={isLoading()}>
              <label for="email" class="font-medium text-muted-foreground text-sm mb-1 block">
                Email Address
              </label>
              <div class="relative z-0 focus-within:z-10">
                <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail class="size-4 text-muted-foreground" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autocomplete="email"
                  placeholder="you@example.com"
                  class="block w-full h-10 px-4 py-2 pl-10 pr-10 text-sm leading-tight align-middle rounded-md bg-background text-foreground shadow-sm border border-border ring-1 ring-border placeholder:text-muted-foreground transition duration-300 ease-in-out focus:z-10 focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                />
                <Show when={email()}>
                  <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label="Clear email"
                      onClick={() => setEmail("")}
                    >
                      <X class="size-4" />
                    </button>
                  </div>
                </Show>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading()}
              class="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md w-full text-primary-foreground bg-primary hover:opacity-90 focus-visible:outline-ring h-10 px-5 text-sm disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading() ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </Show>
        <p class="text-xs mt-4 font-medium text-muted-foreground flex items-center justify-center">
          <A
            href="/auth/login"
            class="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft class="size-3.5" />
            Back to sign in
          </A>
        </p>
      </div>
    </main>
  );
}
