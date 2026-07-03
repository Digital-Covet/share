import { A } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { Eye, EyeOff, Mail, X } from "lucide-solid";
import { createSignal, type JSX, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";
import { pageMetadata } from "@/lib/seo";

export default function LoginForm() {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [showPassword, setShowPassword] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
    e,
  ) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authClient.signIn.email(
        {
          email: email(),
          password: password(),
        },
        {
          onSuccess: (ctx) => {
            if (ctx.data.twoFactorRedirect) {
              return;
            }

            window.location.href = "/dashboard";
          },

          onError: (ctx) => {
            const message =
              ctx.error.message ?? "Invalid email or password";
            setError(message);
          },

          onResponse: () => {
            setIsLoading(false);
          },
        },
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <main class="h-screen w-screen flex items-center justify-center">
      <Title>{pageMetadata.login.title}</Title>
      <Meta name="description" content={pageMetadata.login.description} />
      <div class="max-w-md p-8 mx-auto bg-card text-card-foreground rounded-xl shadow-md">
        <div class="text-center">
          <h2 class="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground font-heading">
            Sign in
          </h2>
          <p class="text-base mt-4 text-muted-foreground text-balance">
            Sign in with your Digital Covet account to manage secure file
            transfers.
          </p>
        </div>
        <form class="mt-10 space-y-4" onSubmit={handleSubmit}>
          <Show when={error()}>
            <div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error()}
            </div>
          </Show>
          <div class="w-full" disabled={isLoading()}>
            <label for="email" class="font-medium text-muted-foreground text-sm mb-1 block">
              Email Address
            </label>
            <div class="relative z-0 focus-within:z-10">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Mail class="size-4 text-muted-foreground" />
              </div>
              <input
                id="email"
                placeholder="you@example.com"
                name="email"
                type="email"
                inputMode="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                class="w-full block transition duration-300 ease-in-out leading-tight align-middle focus:z-10 pl-10 h-10 px-4 py-2 text-sm rounded-md bg-background border border-border text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none shadow-sm"
              />
            </div>
          </div>
          <div class="w-full" required disabled={isLoading()}>
            <label for="password" class="font-medium text-muted-foreground text-sm mb-1 block">
              Password <span class="text-destructive">*</span>
            </label>
            <div class="relative z-0 focus-within:z-10">
              <input
                id="password"
                placeholder="••••••••"
                name="password"
                type={showPassword() ? "text" : "password"}
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                class="w-full block transition duration-300 ease-in-out leading-tight align-middle focus:z-10 h-10 px-4 py-2 text-sm rounded-md bg-background border border-border text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none shadow-sm"
              />
              <div class="absolute inset-y-0 right-0 flex items-center pr-3 gap-2">
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
                <Show when={password()}>
                  <button
                    type="button"
                    onClick={() => setPassword("")}
                    class="text-muted-foreground hover:text-foreground focus:outline-none focus:text-foreground transition-colors"
                    aria-label="Clear password"
                  >
                    <X class="size-4" />
                  </button>
                </Show>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading()}
            class="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md w-full text-primary-foreground bg-primary hover:opacity-90 focus-visible:outline-ring h-10 px-5 text-sm disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading() ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p class="text-xs mt-4 font-medium text-muted-foreground">
          <A
            href="/auth/forgot-password"
            class="font-medium text-foreground hover:text-primary transition-colors"
          >
            Forgot your password?
          </A>
        </p>
      </div>
    </main>
  );
}
