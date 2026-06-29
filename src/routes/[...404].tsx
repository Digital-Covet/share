import { Meta, Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import { pageMetadata } from "@/lib/seo";

export default function NotFound() {
	return (
		<main>
			<Title>{pageMetadata.notFound.title}</Title>
			<Meta name="description" content={pageMetadata.notFound.description} />
			<HttpStatusCode code={404} />
			<h1>Page Not Found</h1>
			<p>
				Visit{" "}
				<a href="https://start.solidjs.com" target="_blank" rel="noopener">
					start.solidjs.com
				</a>{" "}
				to learn how to build SolidStart apps.
			</p>
		</main>
	);
}
