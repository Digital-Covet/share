import { Title } from "@solidjs/meta";
import { LoaderCircle } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onMount,
  Show,
} from "solid-js";
import { isServer } from "solid-js/web";
import AuthGuard from "@/components/auth/auth-guard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DeleteConfirmModal } from "@/components/dashboard/DeleteConfirmModal";
import { EditExpiryModal } from "@/components/dashboard/EditExpiryModal";
import { FileTable } from "@/components/dashboard/FileTable";
import { StatsOverview } from "@/components/dashboard/StatOverview";
import { Toast } from "@/components/dashboard/Toast";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { apiUrl } from "@/lib/api/url";
import type { FileItem } from "@/types/dashboard";

async function fetchFiles(): Promise<FileItem[]> {
  if (isServer) return [];
  const res = await fetch(apiUrl("/api/files"), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load files");
  const data = await res.json();
  return data.files as FileItem[];
}

export default function Dashboard() {
  const [files, setFiles] = createSignal<FileItem[]>([]);
  const [remoteFiles, { refetch }] = createResource(fetchFiles);
  const isLoading = () => remoteFiles.loading && !remoteFiles();

  onMount(() => {
    refetch();
  });

  createEffect(
    on(remoteFiles, (data) => {
      if (data) setFiles(data);
    }),
  );

  createEffect(() => {
    const err = remoteFiles.error;
    if (err instanceof Error) {
      showToast(err.message);
    }
  });

  const [searchTerm, setSearchTerm] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal("All");
  const [sortField, setSortField] = createSignal("name");
  const [sortDirection, setSortDirection] = createSignal<"asc" | "desc">("asc");

  const [isEditOpen, setIsEditOpen] = createSignal(false);
  const [isDeleteOpen, setIsDeleteOpen] = createSignal(false);
  const [selectedFile, setSelectedFile] = createSignal<FileItem | null>(null);
  const [toastMessage, setToastMessage] = createSignal("");
  const [isToastOpen, setIsToastOpen] = createSignal(false);

  const activeLinks = createMemo(
    () => files().filter((f) => f.status === "Active").length,
  );

  const totalDownloads = createMemo(() =>
    files().reduce((sum, f) => sum + f.downloads, 0),
  );

  const storageUsedGB = createMemo(() => {
    const totalBytes = files().reduce((sum, f) => sum + f.sizeBytes, 0);
    return totalBytes / (1024 * 1024 * 1024);
  });

  const handleCopyLink = (file: FileItem) => {
    const url = `${window.location.origin}/s/${file.shareLinkId ?? file.id}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => showToast(`Link copied for: ${file.name}`))
        .catch(() => showToast(`Failed to copy link. Generated link: ${url}`));
    } else {
      showToast(`Link generated: ${url}`);
    }
  };

  const handleTriggerEditExpiry = (file: FileItem) => {
    if (file.status === "Revoked" || file.status === "Deleted") {
      showToast(
        file.status === "Revoked"
          ? "Cannot edit expiry: this file has been revoked."
          : "Cannot edit expiry: this file has been permanently deleted.",
      );
      return;
    }
    setSelectedFile(file);
    setIsEditOpen(true);
  };

  const handleSaveExpiry = async (
    fileId: string,
    display: string,
    timestamp: number,
  ) => {
    const file = files().find((f) => f.id === fileId);
    if (!file) return;

    try {
      const res = await fetch(apiUrl(`/api/files/${fileId}/update-expiry`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt: timestamp }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(`Failed to update expiry: ${body.error ?? "Unknown error"}`);
        return;
      }

      setFiles((prev) =>
        prev.map((f) => {
          if (f.id === fileId) {
            let updatedStatus = f.status;
            if (display === "Upon DL") {
              updatedStatus = "One-Time";
            } else if (display === "Never") {
              updatedStatus = "Active";
            } else if (f.status === "Expired" && timestamp > Date.now()) {
              updatedStatus = "Active";
            }

            return {
              ...f,
              expiryDisplay: display,
              expiryTimestamp: timestamp,
              status: updatedStatus,
            };
          }
          return f;
        }),
      );

      showToast(`Expiry updated successfully for: ${file.name}`);
    } catch {
      showToast(`Failed to update expiry: ${file.name}`);
    }
  };

  const handleTriggerDelete = (file: FileItem) => {
    setSelectedFile(file);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async (fileId: string) => {
    const fileToDelete = files().find((f) => f.id === fileId);
    if (!fileToDelete) return;

    try {
      const res = await fetch(apiUrl(`/api/files/${fileId}/delete`), {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(`Failed to delete: ${body.error ?? "Unknown error"}`);
        return;
      }

      setFiles((prev) => prev.filter((file) => file.id !== fileId));
      showToast(`Revoked transfer link and deleted: ${fileToDelete.name}`);
    } catch {
      showToast(`Failed to delete: ${fileToDelete.name}`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setIsToastOpen(true);
    setTimeout(() => {
      setIsToastOpen(false);
    }, 3500);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setSortField("name");
    setSortDirection("asc");
    showToast("Filters and sorting have been reset");
  };

  const processedFiles = createMemo(() => {
    let result = [...files()];

    const search = searchTerm().toLowerCase().trim();
    if (search) {
      result = result.filter((file) =>
        file.name.toLowerCase().includes(search),
      );
    }

    const status = statusFilter();
    if (status !== "All") {
      result = result.filter((file) => file.status === status);
    }

    const field = sortField();
    const dir = sortDirection();

    result.sort((a, b) => {
      let comparison = 0;

      if (field === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (field === "size") {
        comparison = a.sizeBytes - b.sizeBytes;
      } else if (field === "downloads") {
        comparison = a.downloads - b.downloads;
      } else if (field === "expiry") {
        comparison = a.expiryTimestamp - b.expiryTimestamp;
      }

      return dir === "asc" ? comparison : -comparison;
    });

    return result;
  });

  return (
    <AuthGuard>
      <>
        <Title>Dashboard</Title>
        <div class="flex h-screen">
          <Sidebar />
          <main class="flex-1 overflow-auto px-6">
            <main class="flex-1 w-full max-w-max-content-width mx-auto p-6 md:p-10">
              <DashboardHeader
                searchTerm={searchTerm()}
                setSearchTerm={setSearchTerm}
                statusFilter={statusFilter()}
                setStatusFilter={setStatusFilter}
                sortField={sortField()}
                setSortField={setSortField}
                sortDirection={sortDirection()}
                setSortDirection={setSortDirection}
                onResetFilters={handleResetFilters}
              />

              <Show
                when={!isLoading()}
                fallback={
                  <div class="flex items-center justify-center py-16 gap-2 text-on-surface-variant">
                    <LoaderCircle size={18} class="animate-spin" />
                    <span class="text-sm">Loading files...</span>
                  </div>
                }
              >
                <StatsOverview
                  activeLinks={activeLinks()}
                  totalDownloads={totalDownloads()}
                  storageUsedGB={storageUsedGB()}
                />

                <FileTable
                  files={processedFiles()}
                  onCopyLink={handleCopyLink}
                  onEditExpiry={handleTriggerEditExpiry}
                  onDelete={handleTriggerDelete}
                />
              </Show>
            </main>

            <EditExpiryModal
              file={selectedFile()}
              isOpen={isEditOpen()}
              onClose={() => {
                setIsEditOpen(false);
                setSelectedFile(null);
              }}
              onSave={handleSaveExpiry}
            />

            <DeleteConfirmModal
              file={selectedFile()}
              isOpen={isDeleteOpen()}
              onClose={() => {
                setIsDeleteOpen(false);
                setSelectedFile(null);
              }}
              onConfirm={handleConfirmDelete}
            />

            <Toast
              message={toastMessage()}
              isOpen={isToastOpen()}
              onClose={() => setIsToastOpen(false)}
            />
          </main>
        </div>
      </>
    </AuthGuard>
  );
}
