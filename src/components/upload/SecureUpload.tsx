import { type Component, createSignal, Show } from "solid-js";
import { apiUrl } from "@/lib/api/url";
import { createZip } from "@/lib/compression";
import {
  deriveIV,
  encryptChunk,
  exportKeyToBase64Url,
  generateMasterKey,
  hashIVBase,
  bufferToBase64Url,
} from "@/lib/crypto";
import type {
  FileMetadata,
  InitiateUploadResponse,
  Phase,
  SecuritySettings,
  ShareData,
} from "@/types/upload";
import { MAX_FILE_SIZE } from "@/lib/constants";
import { CHUNK_SIZE, formatFileSize, getTotalChunks } from "@/utils/upload";
import DropZone from "./DropZone";
import SettingsPanel from "./SettingsPanel";
import UploadProgress from "./UploadProgress";
import UploadSuccess from "./UploadSuccess";

const REFRESH_BUFFER_MS = 5000;
const REFRESH_CHECK_INTERVAL_MS = 1000;

const DEFAULT_SETTINGS: SecuritySettings = {
  expiration: "24h",
  oneTimeDownload: false,
  maxDownloads: 10,
};

interface SelectedFile {
  meta: FileMetadata;
  raw: File;
}

interface UploadedFile {
  shareLinkId: string;
  meta: FileMetadata;
}

function encodeAAD(
  fileId: string,
  chunkIndex: number,
  totalChunks: number,
): Uint8Array {
  const payload = JSON.stringify({ fileId, chunkIndex, totalChunks });
  return new TextEncoder().encode(payload);
}

const SecureUpload: Component = () => {
  const [phase, setPhase] = createSignal<Phase>("idle");
  const [selectedFiles, setSelectedFiles] = createSignal<SelectedFile[]>([]);
  const [uploadProgress, setUploadProgress] = createSignal(0);
  const [currentFileIndex, setCurrentFileIndex] = createSignal(0);
  const [currentArchiveName, setCurrentArchiveName] = createSignal("");
  const [uploadedFiles, setUploadedFiles] = createSignal<UploadedFile[]>([]);
  const [settings, setSettings] =
    createSignal<SecuritySettings>(DEFAULT_SETTINGS);

  const [archiveSize, setArchiveSize] = createSignal(0);
  const [fileSizeError, setFileSizeError] = createSignal<string | null>(null);

  const currentFileName = () => {
    const files = selectedFiles();
    const idx = currentFileIndex();
    return files[idx]?.meta.name ?? "";
  };

  const totalFiles = () => selectedFiles().length;

  const uploadedSize = () =>
    Math.floor((archiveSize() * uploadProgress()) / 100);

  const totalSize = () => archiveSize() || selectedFiles().reduce((sum, f) => sum + f.meta.size, 0);

  const uploadedTotalSize = () => uploadedSize();

  const handleFilesSelect = (files: File[]) => {
    setFileSizeError(null);
    const oversized = files.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setFileSizeError(
        `"${oversized.name}" exceeds the ${formatFileSize(MAX_FILE_SIZE)} limit.`,
      );
      return;
    }
    const newSelected = files.map((file) => ({
      meta: { name: file.name, size: file.size },
      raw: file,
    }));
    setSelectedFiles((prev) => [...prev, ...newSelected]);
    if (phase() === "idle") setPhase("selecting");
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFiles().length === 0) setPhase("idle");
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setUploadProgress(0);
    setCurrentFileIndex(0);
    setCurrentArchiveName("");
    setArchiveSize(0);
    setUploadedFiles([]);
    setFileSizeError(null);
    setPhase("idle");
  };

  const handleUpload = async () => {
    const files = selectedFiles();
    if (files.length === 0) return;

    setPhase("uploading");
    setUploadProgress(0);
    setCurrentFileIndex(0);
    setUploadedFiles([]);

    const currentSettings = settings();

    try {
      const isSingleFile = files.length === 1;
      const archiveName = isSingleFile ? files[0].meta.name : "files.zip";
      setCurrentArchiveName(archiveName);

      let source: Blob;
      let mimeType: string;
      let archiveSize: number;

      if (isSingleFile) {
        source = files[0].raw;
        mimeType = files[0].raw.type || "application/octet-stream";
        archiveSize = files[0].raw.size;
      } else {
        const fileData = await Promise.all(
          files.map(async ({ meta, raw }) => ({
            name: meta.name,
            data: new Uint8Array(await raw.arrayBuffer()),
          })),
        );
        const archive = await createZip(fileData);
        source = new Blob([archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as BlobPart]);
        mimeType = "application/zip";
        archiveSize = archive.byteLength;
      }

      setArchiveSize(archiveSize);
      const totalChunks = getTotalChunks(archiveSize);

      const masterKey = await generateMasterKey();
      const ivBase = new Uint8Array(12);
      crypto.getRandomValues(ivBase);
      const ivBaseHash = await hashIVBase(ivBase);
      const keyBase64Url = await exportKeyToBase64Url(masterKey);

      const initRes = await fetch(apiUrl("/api/files/initiate-upload"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: archiveName,
          mime_type: mimeType,
          original_size: archiveSize,
          total_chunks: totalChunks,
          iv_base_hash: ivBaseHash,
          encryption_key: keyBase64Url,
          iv_base: bufferToBase64Url(ivBase.buffer as ArrayBuffer),
        }),
      });
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => null);
        throw new Error(err?.error ?? "Init failed");
      }
      const { fileId, uploadId, presignedUrls }: InitiateUploadResponse =
        await initRes.json();

      const etags: { partNumber: number; etag: string }[] = [];
      let totalEncryptedSize = 0;

      const urls = presignedUrls.map((entry) => ({ ...entry }));

      const refreshUrls = async (partNumbers: number[]) => {
        if (partNumbers.length === 0) return;
        const qs = new URLSearchParams({ fileId });
        for (const p of partNumbers) qs.append("parts", String(p));
        try {
          const res = await fetch(apiUrl(`/api/files/resume-upload?${qs}`));
          if (!res.ok) return;
          const { presignedUrls: fresh } = await res.json();
          for (const freshUrl of fresh) {
            const target = urls.find(
              (u) => u.partNumber === freshUrl.partNumber,
            );
            if (target) {
              target.url = freshUrl.url;
              target.expiresAt = freshUrl.expiresAt;
            }
          }
        } catch {
          /* best-effort */
        }
      };

      const refreshTimer = setInterval(() => {
        const now = Date.now();
        const stale = urls
          .filter(
            (u) => new Date(u.expiresAt).getTime() - now < REFRESH_BUFFER_MS,
          )
          .map((u) => u.partNumber);
        if (stale.length > 0) void refreshUrls(stale);
      }, REFRESH_CHECK_INTERVAL_MS);

      try {
        for (let i = 0; i < urls.length; i++) {
          const { partNumber, url } = urls[i];
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, archiveSize);
          const slice = source.slice(start, end);
          const chunk = new Uint8Array(await slice.arrayBuffer());

          const iv = deriveIV(ivBase, i);
          const aad = encodeAAD(fileId, i, totalChunks);
          const encrypted = await encryptChunk(masterKey, iv, aad, chunk);
          totalEncryptedSize += encrypted.byteLength;

          const chunkRes = await fetch(url, {
            method: "PUT",
            body: encrypted,
          });
          if (!chunkRes.ok)
            throw new Error(`Chunk ${partNumber} upload failed`);

          const etag = chunkRes.headers.get("ETag");
          if (!etag) throw new Error("Missing ETag");
          etags.push({ partNumber, etag });

          setUploadProgress(Math.floor(((i + 1) / urls.length) * 100));
        }
      } finally {
        clearInterval(refreshTimer);
      }

      const isMultipart = uploadId !== null;
      const completeRes = await fetch(
        apiUrl(isMultipart ? "/api/files/complete-upload" : "/api/files/finalize"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId,
            encrypted_size: totalEncryptedSize,
            ...(isMultipart ? { etags } : {}),
            security_settings: currentSettings,
          }),
        },
      );

      if (!completeRes.ok) throw new Error("Finalize failed");
      const completeData: {
        shareLink: { id: string; expiresAt: string | null };
      } = await completeRes.json();

      const archiveMeta: FileMetadata = {
        name: archiveName,
        size: archiveSize,
      };

      setUploadedFiles([
        { shareLinkId: completeData.shareLink.id, meta: archiveMeta },
      ]);
      setUploadProgress(100);
      setPhase("success");
    } catch (error) {
      console.error("Upload failed:", error);
      setPhase("error");
    }
  };

  const handleCancel = () => {
    handleReset();
  };

  const isSettingsPanelLocked = () =>
    phase() === "uploading" || phase() === "success";

  const shareDataList = (): ShareData[] => {
    return uploadedFiles().map((f) => ({
      url: `${window.location.origin}/s/${f.shareLinkId}`,
    }));
  };

  return (
    <div class="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader />

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div class="lg:col-span-8 flex flex-col gap-6">
          <Show when={phase() === "idle" || phase() === "selecting"}>
            <DropZone
              onFilesSelect={handleFilesSelect}
              selectedFiles={selectedFiles().map((f) => f.meta)}
              onRemoveFile={handleRemoveFile}
              onReset={handleReset}
              disabled={phase() === "uploading"}
            />
          </Show>

          <Show when={fileSizeError()}>
            <div class="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {fileSizeError()}
            </div>
          </Show>

          <Show when={phase() === "uploading"}>
            <UploadProgress
              fileName={currentArchiveName() || currentFileName()}
              progress={uploadProgress()}
              uploadedSize={uploadedTotalSize()}
              totalSize={totalSize()}
              currentFileIndex={0}
              totalFiles={1}
              onCancel={handleCancel}
            />
          </Show>

          <Show when={phase() === "success" && uploadedFiles().length > 0}>
            <UploadSuccess
              shareDataList={shareDataList()}
              uploadedFiles={uploadedFiles().map((f) => f.meta)}
              onNewUpload={handleReset}
            />
          </Show>
        </div>

        <div class="lg:col-span-4">
          <SettingsPanel
            settings={settings()}
            onSettingsChange={setSettings}
            onUpload={handleUpload}
            disabled={isSettingsPanelLocked()}
            canUpload={phase() === "selecting"}
          />
        </div>
      </div>
    </div>
  );
};

const PageHeader: Component = () => (
  <div class="mb-8">
    <h2 class="font-heading font-bold text-foreground tracking-tight">
      Secure Upload
    </h2>
    <p class="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
      Encrypted file sharing for sensitive data. Files are encrypted before
      upload and stored securely.
    </p>
  </div>
);

export default SecureUpload;
