import { Field } from "@ark-ui/solid/field";
import { PinInput } from "@ark-ui/solid/pin-input";
import { useNavigate } from "@solidjs/router";
import { createEffect, createSignal, For, onCleanup } from "solid-js";
import { AuthToaster, authToaster } from "@/components/auth/auth-toaster";
import { authClient } from "@/lib/auth-client";

interface TwoFactorVerifyProps {
  redirectTo?: string;
  onVerified?: () => void;
}

type AuthMode = "totp" | "backup";

const createEmptyPin = (count: number) =>
  Array.from({ length: count }, () => "");

export default function TwoFactorVerify({
  redirectTo = "/dashboard",
  onVerified,
}: TwoFactorVerifyProps) {
  const navigate = useNavigate();
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

      authToaster.create({
        title: "Verification successful!",
        type: "success",
      });
      onVerified?.();
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid code. Please try again.";

      setError(message);
      setCooldown(5);
      clearCode();

      authToaster.create({
        title: message,
        type: "error",
      });
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
    <div class="space-y-4">
      <form onSubmit={handleSubmit} class="space-y-4">
        <Field.Root invalid={error() !== null} disabled={disabled()}>
          <div class="space-y-3">
            <Field.Label class="block text-center text-sm font-medium">
              {isTotp() ? "Authenticator code" : "Backup code"}
            </Field.Label>
            {isTotp() ? (
              <PinInput.Root
                value={pinValue()}
                onValueChange={({ value }) => {
                  setPinValue(value);
                  setCode(value.join(""));
                  setError(null);
                }}
                count={6}
                otp
                type="numeric"
                disabled={disabled()}
                invalid={error() !== null}
                aria-label="Authenticator code"
              >
                <PinInput.Control class="flex justify-center gap-2">
                  <For each={Array.from({ length: 6 }, (_, index) => index)}>
                    {(index) => (
                      <PinInput.Input
                        index={index}
                        class="h-12 w-12 rounded-md border border-input bg-background text-center text-lg font-semibold shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    )}
                  </For>
                </PinInput.Control>
                <PinInput.HiddenInput />
              </PinInput.Root>
            ) : (
              <Field.Input
                id="code"
                type="text"
                autocomplete="off"
                maxlength={24}
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
          {error() && (
            <Field.ErrorText class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error()}
            </Field.ErrorText>
          )}
        </Field.Root>
        <button
          type="submit"
          class="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          disabled={disabled() || code().length === 0}
        >
          {isLoading()
            ? "Verifying..."
            : cooldown() > 0
              ? `Try again in ${cooldown()}s`
              : "Verify code"}
        </button>
      </form>
      <div class="relative py-2">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t" />
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-background px-2 text-muted-foreground">
            Having trouble?
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={toggleMode}
        class="inline-flex h-10 w-full items-center justify-center rounded-md border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
      >
        {isTotp()
          ? "Use a backup code instead"
          : "Use authenticator app instead"}
      </button>
      <AuthToaster />
    </div>
  );
}
