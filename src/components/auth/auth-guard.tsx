import { type JSX, Show } from "solid-js";

interface AuthGuardProps {
  children: JSX.Element;
  isChecking?: boolean;
}

export default function AuthGuard(props: AuthGuardProps) {
  return (
    <Show
      when={!props.isChecking}
      fallback={
        <div class="flex h-screen items-center justify-center">Loading...</div>
      }
    >
      {props.children}
    </Show>
  );
}
