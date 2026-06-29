import { Meta, Title } from "@solidjs/meta";
import { Navigate } from "@solidjs/router";
import { pageMetadata } from "@/lib/seo";

export default function Home() {
	return (
		<>
			<Title>{pageMetadata.home.title}</Title>
			<Meta name="description" content={pageMetadata.home.description} />
			<Navigate href="/auth/login" />
		</>
	);
}
