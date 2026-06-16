import { useNavigate } from "@solidjs/router";
import { LogOut } from "lucide-solid";
import { createSignal } from "solid-js";
import { authClient } from "@/lib/auth-client";

interface SignOutButtonProps {
	class?: string;
	showIcon?: boolean;
	label?: string;
}

export default function SignOutButton(props: SignOutButtonProps) {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = createSignal(false);

	const handleSignOut = async () => {
		setIsLoading(true);

		try {
			await authClient.signOut({
				fetchOptions: {
					onSuccess: () => {
						navigate("/auth/login", { replace: true });
					},
				},
			});
		} catch (error) {
			console.error("Sign out failed:", error);
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
