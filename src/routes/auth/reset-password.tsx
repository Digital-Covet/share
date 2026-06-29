import { Field } from "@ark-ui/solid/field";
import { PasswordInput } from "@ark-ui/solid/password-input";
import { A, useNavigate } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { EyeIcon, EyeOffIcon } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import { AuthToaster, authToaster } from "@/components/auth/auth-toaster";
import { authClient } from "@/lib/auth-client";
import { pageMetadata } from "@/lib/seo";

export default function ResetPasswordForm() {
  const navigate = useNavigate();
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [resetToken, setResetToken] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    const currentUrl = new URL(window.location.href);
    const token = currentUrl.searchParams.get("token");

    setResetToken(token);

    if (token) {
      currentUrl.searchParams.delete("token");
      window.history.replaceState(
        window.history.state,
        document.title,
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      );
    }
  });

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError(null);

    if (password() !== confirmPassword()) {
      setError("Passwords do not match");
      return;
    }

    if (password().length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    const token = resetToken();
    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setIsLoading(true);
    try {
      const response = await authClient.resetPassword({
        newPassword: password(),
        token,
      });

      if (response.error) {
        throw new Error(response.error.message ?? "Failed to reset password");
      }

      authToaster.create({
        title: "Password reset successfully!",
        type: "success",
      });
      navigate("/auth/login", { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to reset password";
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
			<Title>{pageMetadata.resetPassword.title}</Title>
			<Meta name="description" content={pageMetadata.resetPassword.description} />
      <div class="max-w-md p-8 mx-auto shadow bg-linear-180 border border-border from-muted to-background rounded-xl">
        <div class="text-center lg:text-balance">
          <h2 class="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground font-heading">
            Reset your password
          </h2>
          <p class="text-base mt-2 text-muted-foreground text-balance">
            Enter your email and choose a new password to regain access to your
            account.
          </p>
        </div>
        <form class="mt-10 space-y-4" onSubmit={handleSubmit}>
          <Show when={error()}>
            <div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error()}
            </div>
          </Show>
          <Field.Root class="w-full" required disabled={isLoading()}>
            <PasswordInput.Root
              name="password"
              autoComplete="new-password"
              required
              class="w-full"
            >
              <PasswordInput.Label class="font-medium text-muted-foreground text-sm mb-1 block">
                New Password
              </PasswordInput.Label>
              <PasswordInput.Control class="relative flex items-center">
                <PasswordInput.Input
                  placeholder="••••••••"
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  class="w-full h-10 px-4 py-2 pr-10 text-sm rounded-md bg-background border border-transparent text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-border focus:ring-border focus:ring-2 focus:outline-none shadow-sm transition duration-300 ease-in-out"
                />
                <PasswordInput.VisibilityTrigger class="absolute right-2 flex items-center justify-center p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  <PasswordInput.Indicator fallback={<EyeOffIcon class="size-4" />}>
                    <EyeIcon class="size-4" />
                  </PasswordInput.Indicator>
                </PasswordInput.VisibilityTrigger>
              </PasswordInput.Control>
            </PasswordInput.Root>
          </Field.Root>
          <Field.Root class="w-full" required disabled={isLoading()}>
            <PasswordInput.Root
              name="confirmPassword"
              autoComplete="new-password"
              required
              class="w-full"
            >
              <PasswordInput.Label class="font-medium text-muted-foreground text-sm mb-1 block">
                Confirm New Password
              </PasswordInput.Label>
              <PasswordInput.Control class="relative flex items-center">
                <PasswordInput.Input
                  placeholder="••••••••"
                  onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                  class="w-full h-10 px-4 py-2 pr-10 text-sm rounded-md bg-background border border-transparent text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-border focus:ring-border focus:ring-2 focus:outline-none shadow-sm transition duration-300 ease-in-out"
                />
                <PasswordInput.VisibilityTrigger class="absolute right-2 flex items-center justify-center p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  <PasswordInput.Indicator fallback={<EyeOffIcon class="size-4" />}>
                    <EyeIcon class="size-4" />
                  </PasswordInput.Indicator>
                </PasswordInput.VisibilityTrigger>
              </PasswordInput.Control>
            </PasswordInput.Root>
          </Field.Root>
          <p class="text-xs font-medium text-muted-foreground">
            Make sure your password is at least 8 characters long and includes a
            mix of letters, numbers, and symbols.
          </p>
          <button
            type="submit"
            disabled={isLoading()}
            class="relative flex items-center justify-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-md w-full h-10 px-5 text-sm text-primary-foreground bg-primary hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading() ? "Resetting..." : "Reset password"}
          </button>
        </form>
        <p class="text-xs mt-4 font-medium text-muted-foreground">
          Remember your password?{" "}
          <A href="/auth/login" class="font-medium text-foreground hover:text-muted-foreground">
            Back to sign in
          </A>
        </p>
      </div>
      <AuthToaster />
    </main>
  );
}
