import { useNavigate } from "@solidjs/router";
import { createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";

interface AuthGuardProps {
  children: JSX.Element;
  redirectTo?: string;
}

export default function AuthGuard(props: AuthGuardProps) {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = createSignal(true);

  onMount(() => {
    let cancelled = false;

    void (async () => {
      try {
        const session = await authClient.getSession();
        if (cancelled) return;

        if (!session.data) {
          navigate(props.redirectTo ?? "/auth/login", { replace: true });
          return;
        }
      } catch {
        if (!cancelled) {
          navigate(props.redirectTo ?? "/auth/login", { replace: true });
        }
        return;
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    })();

    onCleanup(() => {
      cancelled = true;
    });
  });

  return (
    <Show
      when={!isChecking()}
      fallback={
        <div class="flex h-screen items-center justify-center">Loading...</div>
      }
    >
      {props.children}
    </Show>
  );
}
