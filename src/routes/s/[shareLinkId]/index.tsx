import { Meta, Title } from "@solidjs/meta";
import { useParams } from "@solidjs/router";
import { ShareDownloadPage } from "@/components/share/ShareDownloadPage";
import { pageMetadata } from "@/lib/seo";

export default function SharedFile() {
	const params = useParams<{ shareLinkId: string }>();

	return (
		<>
			<Title>{pageMetadata.shareLink.title}</Title>
			<Meta name="description" content={pageMetadata.shareLink.description} />
			<Meta name="robots" content="noindex, nofollow" />
			<ShareDownloadPage shareLinkId={params.shareLinkId} />
		</>
	);
}
