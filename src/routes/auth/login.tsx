import { Meta, Title } from "@solidjs/meta";
import { createSignal, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";
import { pageMetadata } from "@/lib/seo";

export default function LoginForm() {
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleOAuthLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { error: authError } = await authClient.signIn.oauth2({
        providerId: "share",
        callbackURL: "/dashboard",
      });

      if (authError) {
        throw new Error(authError.message ?? "Failed to sign in");
      }
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
        <div class="mt-10 space-y-4">
          <Show when={error()}>
            <div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error()}
            </div>
          </Show>
          <button
            type="button"
            onClick={handleOAuthLogin}
            disabled={isLoading()}
            class="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md w-full text-primary-foreground bg-primary hover:opacity-90 focus-visible:outline-ring h-10 px-5 text-sm disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading() ? "Redirecting..." : "Sign in with Digital Covet"}
          </button>
        </div>
      </div>
    </main>
  );
}
