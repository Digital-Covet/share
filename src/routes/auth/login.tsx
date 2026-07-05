import { Meta, Title } from "@solidjs/meta";
import { pageMetadata } from "@/lib/seo";

const IAM_BASE_URL = import.meta.env.VITE_BETTER_AUTH_URL ?? "https://iam.digitalcovet.com";

export default function LoginRedirect() {
  const redirectUrl = `${IAM_BASE_URL}/auth/login?redirect=${encodeURIComponent(`${window.location.origin}/dashboard`)}`;

  return (
    <>
      <Title>{pageMetadata.login.title}</Title>
      <Meta name="description" content={pageMetadata.login.description} />
      <script>
        {`window.location.replace(${JSON.stringify(redirectUrl)});`}
      </script>
      <main class="h-screen w-screen flex items-center justify-center">
        <p class="text-muted-foreground">Redirecting to sign in...</p>
      </main>
    </>
  );
}
