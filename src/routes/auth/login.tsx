import { Field } from "@ark-ui/solid/field";
import { A, useNavigate } from "@solidjs/router";
import { Eye, EyeOff, Mail, X } from "lucide-solid";
import { createSignal, type JSX, Show } from "solid-js";
import { authToaster, AuthToaster } from "@/components/auth/auth-toaster";
import { authClient } from "@/lib/auth-client";

export default function LoginForm() {
  const navigate = useNavigate();
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
      const response = await authClient.signIn.email({
        email: email(),
        password: password(),
      });

      if (response.error) {
        throw new Error(response.error.message ?? "Invalid email or password");
      }

      if ("twoFactorRedirect" in response && response.twoFactorRedirect) {
        return;
      }

      authToaster.create({
        title: "Signed in successfully!",
        type: "success",
      });
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid email or password";
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
      <div class="max-w-md p-8 mx-auto bg-card text-card-foreground rounded-xl shadow-md">
        <div class="text-center">
          <h2 class="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground font-heading">
            Sign in
          </h2>
          <p class="text-base mt-4 text-muted-foreground text-balance">
            Welcome back! Fire up that password muscle memory, just like the
            good old dial-up days.
          </p>
        </div>
        <form class="mt-10 space-y-4" onSubmit={handleSubmit}>
          <Show when={error()}>
            <div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error()}
            </div>
          </Show>
          <Field.Root class="w-full" disabled={isLoading()}>
            <Field.Label class="font-medium text-muted-foreground text-sm mb-1 block">
              Email Address
            </Field.Label>
            <div class="relative z-0 focus-within:z-10">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Mail class="size-4 text-muted-foreground" />
              </div>
              <Field.Input
                placeholder="you@example.com"
                name="email"
                type="email"
                inputMode="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                class="w-full block transition duration-300 ease-in-out leading-tight align-middle focus:z-10 pl-10 h-10 px-4 py-2 text-sm rounded-md bg-background border border-border text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none shadow-sm"
              />
            </div>
          </Field.Root>
          <Field.Root class="w-full" required disabled={isLoading()}>
            <Field.Label class="font-medium text-muted-foreground text-sm mb-1 block">
              Password <Field.RequiredIndicator class="text-destructive" />
            </Field.Label>
            <div class="relative z-0 focus-within:z-10">
              <Field.Input
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
          </Field.Root>
          <button
            type="submit"
            disabled={isLoading()}
            class="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md w-full text-primary-foreground bg-primary hover:opacity-90 focus-visible:outline-ring h-10 px-5 text-sm disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading() ? "Signing in..." : "Sign in with email"}
          </button>
        </form>
        <p class="text-xs mt-4 font-medium text-muted-foreground">
          Forgot your account?{" "}
          <A
            href="/auth/forgot-password"
            class="font-medium text-foreground hover:text-primary transition-colors"
          >
            Sign up
          </A>
        </p>
      </div>
      <AuthToaster />
    </main>
  );
}
