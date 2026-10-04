import { Meta, Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { LoginCard } from "@/components/auth/LoginCard";
import { pageMetadata } from "@/lib/seo";

export default function Login() {
	const [params] = useSearchParams<{ redirect?: string }>();

	return (
		<>
			<Title>{pageMetadata.login.title}</Title>
			<Meta name="description" content={pageMetadata.login.description} />
			<main class="security-grid flex min-h-screen items-center justify-center p-4">
				<LoginCard redirect={params.redirect} />
			</main>
		</>
	);
}
