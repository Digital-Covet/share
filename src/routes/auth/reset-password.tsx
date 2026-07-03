import { A, useNavigate } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { Eye, EyeOff } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";
import { pageMetadata } from "@/lib/seo";

export default function ResetPasswordForm() {
  const navigate = useNavigate();
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [showPassword, setShowPassword] = createSignal(false);
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

      navigate("/auth/login", { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to reset password";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main class="h-screen w-screen flex items-center justify-center">
      <Title>{pageMetadata.resetPassword.title}</Title>
      <Meta
        name="description"
        content={pageMetadata.resetPassword.description}
      />
      <div class="max-w-md p-8 mx-auto bg-card text-card-foreground rounded-xl shadow-md">
        <div class="text-center">
          <h2 class="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground font-heading">
            Reset your password
          </h2>
          <p class="text-base mt-4 text-muted-foreground text-balance">
            Enter your new password below to regain access to your account.
          </p>
        </div>
        <form class="mt-10 space-y-4" onSubmit={handleSubmit}>
          <Show when={error()}>
            <div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error()}
            </div>
          </Show>
          <div class="w-full" required disabled={isLoading()}>
            <label for="new-password" class="font-medium text-muted-foreground text-sm mb-1 block">
              New Password <span class="text-destructive">*</span>
            </label>
            <div class="relative z-0 focus-within:z-10">
              <input
                id="new-password"
                placeholder="••••••••"
                name="password"
                type={showPassword() ? "text" : "password"}
                autoComplete="new-password"
                onInput={(e) => setPassword(e.currentTarget.value)}
                class="w-full block transition duration-300 ease-in-out leading-tight align-middle focus:z-10 h-10 px-4 py-2 text-sm rounded-md bg-background border border-border text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none shadow-sm"
              />
              <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword())}
                  class="text-muted-foreground hover:text-foreground focus:outline-none focus:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword() ? "Hide password" : "Show password"}
                >
                  {showPassword() ? (
                    <EyeOff class="size-4" />
                  ) : (
                    <Eye class="size-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div class="w-full" required disabled={isLoading()}>
            <label for="confirm-password" class="font-medium text-muted-foreground text-sm mb-1 block">
              Confirm New Password <span class="text-destructive">*</span>
            </label>
            <div class="relative z-0 focus-within:z-10">
              <input
                id="confirm-password"
                placeholder="••••••••"
                name="confirmPassword"
                type={showPassword() ? "text" : "password"}
                autoComplete="new-password"
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                class="w-full block transition duration-300 ease-in-out leading-tight align-middle focus:z-10 h-10 px-4 py-2 text-sm rounded-md bg-background border border-border text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none shadow-sm"
              />
            </div>
          </div>
          <p class="text-xs font-medium text-muted-foreground">
            Make sure your password is at least 8 characters long.
          </p>
          <button
            type="submit"
            disabled={isLoading()}
            class="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md w-full text-primary-foreground bg-primary hover:opacity-90 focus-visible:outline-ring h-10 px-5 text-sm disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading() ? "Resetting..." : "Reset password"}
          </button>
        </form>
        <p class="text-xs mt-4 font-medium text-muted-foreground flex items-center justify-center">
          <A
            href="/auth/login"
            class="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
          >
            Back to sign in
          </A>
        </p>
      </div>
    </main>
  );
}
