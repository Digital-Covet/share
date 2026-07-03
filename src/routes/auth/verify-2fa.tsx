import { Meta, Title } from "@solidjs/meta";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";
import { pageMetadata } from "@/lib/seo";

type AuthMode = "totp" | "backup";

const createEmptyPin = (count: number) =>
  Array.from({ length: count }, () => "");

export default function Verify2FA() {
  const [mode, setMode] = createSignal<AuthMode>("totp");
  const [code, setCode] = createSignal("");
  const [pinValue, setPinValue] = createSignal<string[]>(createEmptyPin(6));
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [cooldown, setCooldown] = createSignal(0);

  createEffect(() => {
    const remaining = cooldown();
    if (remaining <= 0) return;

    const timer = window.setTimeout(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    onCleanup(() => window.clearTimeout(timer));
  });

  const clearCode = () => {
    setCode("");
    setPinValue(createEmptyPin(6));
  };

  const validateInput = (): boolean => {
    if (mode() === "totp") {
      return /^\d{6}$/.test(code());
    }
    return code().trim().length >= 8;
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();

    if (cooldown() > 0) return;

    if (!validateInput()) {
      setError(
        mode() === "totp"
          ? "Please enter a valid 6-digit code."
          : "Please enter a valid backup code.",
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let response: { error?: { message?: string } | null } | undefined;

      if (mode() === "totp") {
        response = await authClient.twoFactor.verifyTotp({
          code: code(),
          trustDevice: false,
        });
      } else {
        response = await authClient.twoFactor.verifyBackupCode({
          code: code(),
          trustDevice: false,
        });
      }

      if (response?.error) {
        throw new Error(response.error.message ?? "Verification failed");
      }

      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid code. Please try again.";

      setError(message);
      setCooldown(5);
      clearCode();
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "totp" ? "backup" : "totp"));
    clearCode();
    setError(null);
  };

  const disabled = () => isLoading() || cooldown() > 0;
  const isTotp = () => mode() === "totp";

  return (
    <main class="h-screen w-screen flex items-center justify-center">
      <Title>{pageMetadata.verify2fa.title}</Title>
      <Meta name="description" content={pageMetadata.verify2fa.description} />
      <div class="max-w-md p-8 mx-auto bg-card text-card-foreground rounded-xl shadow-md">
        <div class="text-center">
          <h1 class="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground font-heading">
            Two-Factor Authentication
          </h1>
          <p class="text-base mt-4 text-muted-foreground text-balance">
            Enter your security code to complete sign-in.
          </p>
        </div>

        <form onSubmit={handleSubmit} class="mt-10 space-y-4">
          <Show when={error()}>
            <div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error()}
            </div>
          </Show>

          <div class="space-y-3">
            <label for="totp-code" class="block text-center text-sm font-medium text-muted-foreground">
              {isTotp() ? "Authenticator code" : "Backup code"}
            </label>
            {isTotp() ? (
              <div class="flex justify-center gap-2">
                <For each={Array.from({ length: 6 }, (_, index) => index)}>
                  {(index) => (
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      disabled={disabled()}
                      value={pinValue()[index] ?? ""}
                      onInput={(e) => {
                        const val = e.currentTarget.value.replace(/\D/g, "");
                        const newPin = [...pinValue()];
                        newPin[index] = val ? val[0] : "";
                        setPinValue(newPin);
                        setCode(newPin.join(""));
                        setError(null);

                        if (val && e.currentTarget.nextElementSibling) {
                          (e.currentTarget.nextElementSibling as HTMLInputElement).focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !pinValue()[index] && index > 0) {
                          const prev = (e.currentTarget.previousElementSibling as HTMLInputElement);
                          if (prev) prev.focus();
                        }
                      }}
                      class="h-12 w-12 rounded-md border border-input bg-background text-center text-lg font-semibold shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  )}
                </For>
              </div>
            ) : (
              <input
                type="text"
                autocomplete="off"
                maxLength={24}
                value={code()}
                onInput={(e) => {
                  setCode(e.currentTarget.value);
                  setError(null);
                }}
                disabled={disabled()}
                placeholder="8+ character backup code"
                class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            )}
          </div>

          <button
            type="submit"
            class="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md w-full text-primary-foreground bg-primary hover:opacity-90 focus-visible:outline-ring h-10 px-5 text-sm disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled() || code().length === 0}
          >
            {isLoading()
              ? "Verifying..."
              : cooldown() > 0
                ? `Try again in ${cooldown()}s`
                : "Verify code"}
          </button>
        </form>

        <div class="relative py-2 mt-4">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t" />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-card px-2 text-muted-foreground">
              Having trouble?
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMode}
          class="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md w-full text-foreground bg-secondary hover:bg-secondary/80 h-10 px-5 text-sm disabled:pointer-events-none disabled:opacity-50"
        >
          {isTotp()
            ? "Use a backup code instead"
            : "Use authenticator app instead"}
        </button>
      </div>
    </main>
  );
}
