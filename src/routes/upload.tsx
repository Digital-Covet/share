import { Meta, Title } from "@solidjs/meta";
import { getRequestEvent } from "solid-js/web";
import { createAsync, query, redirect } from "@solidjs/router";
import { Sidebar } from "@/components/sidebar/Sidebar";
import SecureUpload from "@/components/upload/SecureUpload";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth.server";

const requireAuth = query(async () => {
  "use server";
  const session = await getSession();
  if (!session?.user) {
    const event = getRequestEvent();
    const currentUrl = event?.request.url ?? "https://share.digitalcovet.com/upload";
    throw redirect(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
  }
  return session.user;
}, "requireAuth");

export default function UploadPage() {
  const _user = createAsync(() => requireAuth());

	return (
		<>
			<Title>{pageMetadata.upload.title}</Title>
			<Meta name="description" content={pageMetadata.upload.description} />
      <div class="flex h-screen">
        <Sidebar />
        <main class="flex-1 w-full max-w-max-content-width mx-auto px-6">
          <SecureUpload />
        </main>
      </div>
    </>
  );
}
