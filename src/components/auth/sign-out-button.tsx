import { LogOut } from "lucide-solid";
import { createSignal } from "solid-js";
import { authClient } from "@/lib/auth-client";

const IAM_BASE_URL = import.meta.env.VITE_BETTER_AUTH_URL ?? "https://iam.digitalcovet.com";

interface SignOutButtonProps {
	class?: string;
	showIcon?: boolean;
	label?: string;
}

export default function SignOutButton(props: SignOutButtonProps) {
	const [isLoading, setIsLoading] = createSignal(false);

	const handleSignOut = async () => {
		setIsLoading(true);

		try {
			await authClient.signOut({
				fetchOptions: {
					onSuccess: () => {
						window.location.href = `${IAM_BASE_URL}/auth/login`;
					},
				},
			});
		} catch (error) {
			console.error("Sign out failed:", error);
			window.location.href = `${IAM_BASE_URL}/auth/login`;
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
