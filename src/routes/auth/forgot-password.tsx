import { Field } from "@ark-ui/solid/field";
import { A } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { ArrowLeft, Mail, X } from "lucide-solid";
import { type Component, createSignal, type JSX, Show } from "solid-js";
import { authToaster, AuthToaster } from "@/components/auth/auth-toaster";
import { authClient } from "@/lib/auth-client";
import { pageMetadata } from "@/lib/seo";

const linkClass = "font-medium text-foreground hover:text-muted-foreground";

const ForgotPasswordForm: Component = () => {
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
        redirectTo: "/auth/reset-password",
      });

      if (response.error) {
        throw new Error(response.error.message ?? "Failed to send reset link");
      }

      setSubmitted(true);
      authToaster.create({
        title: "Reset link sent! Check your email.",
        type: "success",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send reset link";
      setError(message);
      authToaster.create({
        title: message,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

	return (
		<main class="h-screen w-screen flex items-center justify-center">
			<Title>{pageMetadata.forgotPassword.title}</Title>
			<Meta name="description" content={pageMetadata.forgotPassword.description} />
      <div class="max-w-md p-8 mx-auto shadow bg-linear-180 outline outline-border from-muted to-background rounded-xl">
        <div class="text-center lg:text-balance">
          <h1 class="font-heading text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
            {submitted() ? "Check your email" : "Forgot your password?"}
          </h1>
          <p class="text-base mt-2 text-muted-foreground text-balance">
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
            <Field.Root class="w-full" required disabled={isLoading()}>
              <Field.Label class="font-medium text-muted-foreground text-sm mb-1 block">
                Email Address
              </Field.Label>
              <div class="relative z-0 focus-within:z-10">
                <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail class="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <Field.Input
                  name="email"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  placeholder="you@example.com"
                  class="block w-full h-10 px-4 py-2 pl-10 pr-10 text-sm leading-tight align-middle rounded-md bg-background text-foreground shadow-sm border border-transparent ring-1 ring-border placeholder:text-muted-foreground transition duration-300 ease-in-out focus:z-10 focus:border-border focus:ring-2 focus:ring-border focus:outline-none"
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
                      <X class="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </Show>
              </div>
            </Field.Root>
            <button
              type="submit"
              disabled={isLoading()}
              class="relative flex w-full h-10 px-5 items-center justify-center text-sm font-medium text-center select-none rounded-md bg-primary text-primary-foreground outline outline-primary transition-colors duration-200 ease-in-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:z-10 disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading() ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </Show>
        <p class="text-xs mt-4 font-medium text-muted-foreground flex items-center justify-center">
          <A href="/auth/login" class={`${linkClass} inline-flex items-center gap-1.5`}>
            <ArrowLeft class="size-3.5" aria-hidden="true" />
            Back to sign in
          </A>
        </p>
      </div>
      <AuthToaster />
    </main>
  );
};

export default ForgotPasswordForm;
