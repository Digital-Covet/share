import { LogOut } from "lucide-solid";
import { createSignal } from "solid-js";
import { ROUTES } from "@/lib/constants";

interface SignOutButtonProps {
	class?: string;
	showIcon?: boolean;
	label?: string;
}

export default function SignOutButton(props: SignOutButtonProps) {
	const [isLoading, setIsLoading] = createSignal(false);

	const handleSignOut = async () => {
		setIsLoading(true);
		console.log("[sign-out-button] Starting sign out");

		try {
			const res = await fetch("/api/sign-out", { method: "POST" });
			console.log("[sign-out-button] Response status:", res.status);

			const data = await res.json();
			console.log("[sign-out-button] Response data:", data);

			window.location.href = ROUTES.LOGIN;
		} catch (error) {
			console.error("[sign-out-button] Sign out failed:", error);
			window.location.href = ROUTES.LOGIN;
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<button
			type="button"
			onClick={handleSignOut}
			disabled={isLoading()}
			class={
				props.class ??
				"inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
			}
		>
			{props.showIcon !== false && <LogOut class="size-4" />}
			{props.label ?? (isLoading() ? "Signing out..." : "Sign out")}
		</button>
	);
}
