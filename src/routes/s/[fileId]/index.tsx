import { CircleAlert, Eye, KeyRound, LoaderCircle, Shield, ShieldOff } from "lucide-solid";
import {
  type Component,
  createMemo,
  createResource,
  createSignal,
  Show,
  Suspense,
} from "solid-js";
import { FilePreview } from "~/components/recieve/FilePreview";
import { type FileMetaResponse, fetchFileMeta } from "~/lib/api/meta";
import { base64UrlToBuffer } from "~/lib/crypto";

const MAX_PASSWORD_ATTEMPTS = 3;

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: FileMetaResponse }
  | { status: "password"; fileId: string }
  | { status: "invalid"; message: string }
  | { status: "expired" }
  | { status: "notfound" }
  | { status: "error"; message: string };

interface MetaResult {
  ok: boolean;
  status: number;
  data?: FileMetaResponse;
  error?: string;
}

interface SharePageProps {
  params: { fileId: string };
}

const SharePage: Component<SharePageProps> = (props) => {
  const fileId = props.params.fileId;

  const [password, setPassword] = createSignal("");
  const [attemptCount, setAttemptCount] = createSignal(0);

  const [metaResult, { refetch }] = createResource<MetaResult, string>(
    password,
    async (pw) => fetchFileMeta(fileId, pw),
  );

  const pageState = createMemo<PageState>(() => {
    if (metaResult.loading) {
      return { status: "loading" };
    }

    const result = metaResult();

    if (!result) {
      return { status: "loading" };
    }

    if (result.ok && result.data) {
      return {
        status: "ready",
        data: result.data,
      };
    }

    switch (result.status) {
      case 401:
        return {
          status: "password",
          fileId,
        };

      case 403:
        return {
          status: "expired",
        };

      case 404:
        return {
          status: "notfound",
        };

      case 429:
        return {
          status: "invalid",
          message: "Too many attempts. Please try again later.",
        };

      default:
        return {
          status: "error",
          message: result.error ?? "Unexpected error",
        };
    }
  });

  const submitPassword = (pw: string) => {
    setAttemptCount((c) => c + 1);
    setPassword(pw);
    refetch();
  };

  const attemptsRemaining = () =>
    Math.max(0, MAX_PASSWORD_ATTEMPTS - attemptCount());

  const lockedOut = () => attemptCount() >= MAX_PASSWORD_ATTEMPTS;

  const renderState = () => {
    const state = pageState();

    switch (state.status) {
      case "loading":
        return <LoadingView />;

      case "ready":
        return <ReadyView data={state.data} />;

      case "password":
        return (
          <PasswordPrompt
            fileId={state.fileId}
            attemptsRemaining={attemptsRemaining()}
            lockedOut={lockedOut()}
            onSubmit={submitPassword}
          />
        );

      case "invalid":
        return (
          <ErrorState
            icon={ShieldOff}
            title="Invalid"
            message={state.message}
          />
        );

      case "expired":
        return (
          <ErrorState
            icon={CircleAlert}
            title="Expired"
            message="This share link has expired."
          />
        );

      case "notfound":
        return (
          <ErrorState
            icon={CircleAlert}
            title="Not Found"
            message="This share link does not exist."
          />
        );

      case "error":
        return (
          <ErrorState
            icon={CircleAlert}
            title="Error"
            message={state.message}
          />
        );
    }
  };

  return (
    <main class="mx-auto max-w-3xl p-6">
      <Suspense fallback={<LoadingView />}>{renderState()}</Suspense>
    </main>
  );
};

export default SharePage;

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

const ReadyView: Component<{ data: FileMetaResponse }> = (props) => {
  const key = () => props.data.encryptionKey ?? null;
  const ivBase = () => {
    const raw = props.data.ivBase;
    if (!raw) return null;
    return new Uint8Array(base64UrlToBuffer(raw));
  };

  const hasData = createMemo(() => {
    return key() !== null && ivBase() !== null;
  });

  return (
    <Show
      when={hasData()}
      fallback={
        <ErrorState
          icon={CircleAlert}
          title="Missing Key"
          message="Encryption key not available for this file."
        />
      }
    >
      <div class="flex flex-col gap-6">
        {/* Page heading */}
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
            <Eye class="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 class="font-heading text-lg font-bold tracking-tight text-foreground">
              Secure File Transfer
            </h1>
            <p class="text-xs text-muted-foreground">
              Encrypted file ready for preview
            </p>
          </div>
        </div>

        <FilePreview
          fileId={props.data.fileId}
          mimeType={props.data.mimeType}
          chunkSize={props.data.chunkSize}
          totalChunks={props.data.totalChunks}
          key={key()!}
          ivBase={ivBase()!}
          fileName={props.data.originalName}
          originalSize={props.data.originalSize}
        />
      </div>
    </Show>
  );
};

interface PasswordPromptProps {
  fileId: string;
  attemptsRemaining: number;
  lockedOut: boolean;
  onSubmit: (pw: string) => void;
}

const PasswordPrompt: Component<PasswordPromptProps> = (props) => {
  const [value, setValue] = createSignal("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (props.lockedOut) return;
    const pw = value().trim();
    if (!pw) return;
    props.onSubmit(pw);
    setValue("");
  };

  return (
    <div class="mx-auto max-w-sm py-16">
      <div class="mb-6 flex flex-col items-center text-center">
        <KeyRound class="mb-3 text-zinc-400" size={32} />
        <h1 class="text-lg font-semibold text-zinc-100">Password Required</h1>
        <p class="mt-1 text-sm text-zinc-400">
          {props.lockedOut
            ? `Maximum attempts (${MAX_PASSWORD_ATTEMPTS}) reached.`
            : `${props.attemptsRemaining} attempt${props.attemptsRemaining === 1 ? "" : "s"} remaining.`}
        </p>
      </div>
      <form onSubmit={handleSubmit} class="space-y-3">
        <input
          type="password"
          value={value()}
          onInput={(e) => setValue(e.currentTarget.value)}
          placeholder="Enter password"
          autocomplete="current-password"
          class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={props.lockedOut || !value().trim()}
          class="w-full rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Unlock
        </button>
      </form>
    </div>
  );
};

interface ErrorStateProps {
  icon: Component<{ size?: number; class?: string }>;
  title: string;
  message: string;
}

const ErrorState: Component<ErrorStateProps> = (props) => {
  const Icon = props.icon;
  return (
    <div class="mx-auto max-w-sm py-16 text-center">
      <Icon class="mx-auto mb-3 text-zinc-400" size={32} />
      <h1 class="text-lg font-semibold text-zinc-100">{props.title}</h1>
      <p class="mt-1 text-sm text-zinc-400">{props.message}</p>
    </div>
  );
};

const LoadingView: Component = () => (
  <div class="flex items-center justify-center py-24 text-zinc-400">
    <LoaderCircle class="mr-2 animate-spin" size={20} />
    Loading…
  </div>
);
