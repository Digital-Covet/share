import { Title } from "@solidjs/meta";
import { Sidebar } from "@/components/sidebar/Sidebar";
import SecureUpload from "@/components/upload/SecureUpload";
import AuthGuard from "@/components/auth/auth-guard";

export default function upload() {
  return (
    <AuthGuard>
      <Title>Upload</Title>
      <div class="flex h-screen">
        <Sidebar />
        <main class="flex-1 w-full max-w-max-content-width mx-auto px-6">
          <SecureUpload />
        </main>
      </div>
    </AuthGuard>
  );
}
