import { ShieldCheck } from "lucide-solid";
import { IamSignInButton } from "./IamSignInButton";
import { SecurityFeatureList } from "./SecurityFeatureList";

const LEGAL_LINKS = [
	{ label: "Enterprise Security Whitepaper", href: "https://digitalcovet.com/security-whitepaper" },
	{ label: "Privacy Policy", href: "https://digitalcovet.com/privacy-policy" },
] as const;

interface LoginCardProps {
	redirect?: string;
}

export function LoginCard(props: LoginCardProps) {
	return (
		<div class="vault-notch-frame w-full max-w-md" style={{ "--notch": "14px" }}>
			<div class="vault-notch relative border border-border bg-surface p-8">
				<span
					class="vault-notch-tick pointer-events-none absolute top-0 right-0"
					aria-hidden="true"
				/>

				<header class="mb-8 text-center">
					<div class="mx-auto mb-3 flex size-10 items-center justify-center text-primary">
						<ShieldCheck class="size-10" stroke-width={1.75} aria-hidden="true" />
					</div>
					<h1 class="font-display text-2xl font-extrabold tracking-[-0.02em] text-text-main">
						Digital Covet IAM
					</h1>
					<p class="mt-1 text-sm text-text-muted">
						Zero-knowledge encrypted transfer network
					</p>
				</header>

				<SecurityFeatureList />
				<IamSignInButton redirect={props.redirect} />

				<footer class="mt-8 flex justify-center gap-4 border-t border-border-subtle pt-4 text-xs text-text-muted">
					{LEGAL_LINKS.map((link) => (
						<a
							href={link.href}
							class="cursor-pointer underline-offset-2 hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
						>
							{link.label}
						</a>
					))}
				</footer>
			</div>
		</div>
	);
}
