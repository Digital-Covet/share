import { useState, type FormEvent, type ReactNode } from 'react'
import { type Data } from '@generated/data'
import { Dialog } from '@base-ui/react/dialog'
import { toast } from 'sonner'
import { Form } from '@adonisjs/inertia/react'
import { CircleAlert, Download, File as FileIcon, LoaderCircle, Trash2 } from 'lucide-react'
import Page from '~/components/page'
import AppLayout from '~/layouts/app'
import { urlFor } from '~/client'
import { formatBytes } from '~/components/file_upload_list'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
/** Luxon serializes dates as `string | null`; null never happens for these columns. */
const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : '')
const personLabel = (user: { name: string | null; email: string }) => user.name || user.email

type TransferFile = Data.Transfer['files'][number]

/** Shield's XSRF-TOKEN cookie, echoed back as the X-XSRF-TOKEN header. */
const xsrfToken = () => {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

/** Messages for the error codes of `POST /transfers/:id/download/:fileId`. */
const DOWNLOAD_ERRORS: Record<string, string> = {
  not_found: 'This file is no longer available',
  forbidden: "You can't download files from this transfer",
  expired: 'This transfer has expired',
  invalid_password: 'Wrong password',
  download_limit_reached: 'The download limit for this transfer has been reached',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
}

/**
 * Ask Share for a presigned URL, then let the browser fetch the file from
 * storage (the response is `Content-Disposition: attachment`, so the page
 * stays put). Resolves to the error code on failure.
 */
async function startDownload(transferId: string, fileId: string, password: string | null) {
  let response: Response
  try {
    response = await fetch(urlFor('transfers.download', { id: transferId, fileId }), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': xsrfToken(),
      },
      body: JSON.stringify({ password }),
    })
  } catch {
    toast.error("Couldn't reach Share. Check your connection and try again.")
    return 'network'
  }
  const data = await response.json().catch(() => null)
  if (response.ok && data?.url) {
    window.location.href = data.url
    return null
  }
  const error: string = data?.error ?? 'unknown'
  toast.error(DOWNLOAD_ERRORS[error] ?? `Couldn't start the download (HTTP ${response.status})`)
  return error
}

export default function ShowTransfer({
  transfer,
  canDelete,
}: {
  transfer: Data.Transfer
  canDelete: boolean
}) {
  const totalBytes = transfer.files.reduce((sum, file) => sum + file.sizeBytes, 0)
  const [pending, setPending] = useState<string | null>(null)
  /** The file waiting for a password, while the dialog is open. */
  const [passwordFor, setPasswordFor] = useState<TransferFile | null>(null)

  const download = async (file: TransferFile) => {
    if (transfer.hasPassword) return setPasswordFor(file)
    setPending(file.id)
    await startDownload(transfer.id, file.id, null)
    setPending(null)
  }

  return (
    <Page
      title={transfer.title}
      description={
        <>
          From {personLabel(transfer.creator)} · sent {formatDate(transfer.createdAt)} ·{' '}
          {transfer.isExpired ? 'expired' : 'expires'} {formatDate(transfer.expiresAt)}
        </>
      }
      actions={canDelete && <DeleteDialog transfer={transfer} />}
    >
      <div className="flex max-w-2xl flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          {transfer.isExpired && <Badge tone="red">Expired</Badge>}
          {!transfer.isConfirmed && <Badge tone="amber">Upload not confirmed</Badge>}
          {transfer.hasPassword && <Badge>Password protected</Badge>}
          {transfer.maxDownloads !== null && (
            <Badge>
              {transfer.successfulDownloads} / {transfer.maxDownloads} downloads
            </Badge>
          )}
        </div>

        {transfer.message && <p className="text-sm whitespace-pre-wrap">{transfer.message}</p>}

        {transfer.isConfirmed ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">
              Files{' '}
              <span className="font-normal text-neutral-500">
                {transfer.files.length} · {formatBytes(totalBytes)}
              </span>
            </h2>
            <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {transfer.files.map((file) => (
                <li key={file.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <FileIcon size={15} className="shrink-0 text-neutral-400" />
                  <span className="min-w-0 flex-1 truncate" title={file.filename}>
                    {file.filename}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                    {formatBytes(file.sizeBytes)}
                  </span>
                  <button
                    type="button"
                    disabled={transfer.isExpired || pending !== null}
                    onClick={() => download(file)}
                    title={transfer.isExpired ? 'This transfer has expired' : 'Download'}
                    aria-label={`Download ${file.filename}`}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-neutral-800 dark:hover:text-white"
                  >
                    {pending === file.id ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Download size={15} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div
            role="status"
            className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            <p>
              The upload for this transfer was never confirmed, so recipients can&apos;t see it.
              Unconfirmed transfers are removed after 24 hours.
            </p>
          </div>
        )}

        {transfer.recipients && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">
              Recipients{' '}
              <span className="font-normal text-neutral-500">{transfer.recipients.length}</span>
            </h2>
            <ul className="flex flex-col gap-1.5">
              {transfer.recipients.map((user) => (
                <li key={user.id} className="flex items-center gap-2 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-200 text-[10px] font-medium dark:bg-neutral-800">
                    {user.initials}
                  </span>
                  <span className="truncate">{personLabel(user)}</span>
                  {user.name && <span className="truncate text-neutral-500">{user.email}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <PasswordDialog
        transferId={transfer.id}
        file={passwordFor}
        onClose={() => setPasswordFor(null)}
      />
    </Page>
  )
}

/**
 * Password prompt for protected transfers. The password goes to Share with
 * the download request and is checked server-side; a wrong one keeps the
 * dialog open.
 */
function PasswordDialog({
  transferId,
  file,
  onClose,
}: {
  transferId: string
  file: TransferFile | null
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [wrong, setWrong] = useState(false)

  const close = () => {
    setPassword('')
    setWrong(false)
    onClose()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file || !password) return
    setSubmitting(true)
    const error = await startDownload(transferId, file.id, password)
    setSubmitting(false)
    if (error === 'invalid_password') setWrong(true)
    else if (error !== 'network') close()
  }

  return (
    <Dialog.Root open={file !== null} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900">
          <Dialog.Title className="text-base font-medium">Password required</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-neutral-500">
            Enter the password the sender shared with you to download{' '}
            <span className="font-medium break-all text-neutral-700 dark:text-neutral-300">
              {file?.filename}
            </span>
            .
          </Dialog.Description>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <input
              type="password"
              autoFocus
              autoComplete="off"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setWrong(false)
              }}
              aria-invalid={wrong}
              aria-label="Password"
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-sm outline-none focus:outline-2 focus:outline-neutral-900 dark:bg-neutral-950 dark:focus:outline-white ${
                wrong ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {wrong && <p className="text-xs text-red-600">Wrong password. Try again.</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close className="rounded-md px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting || !password}
                className="btn btn--primary inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {submitting && <LoaderCircle size={14} className="animate-spin" />}
                Download
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * "Delete" with a confirmation step. Submits `DELETE /transfers/:id` as an
 * Inertia form; the server redirects to the list with a flash.
 */
function DeleteDialog({ transfer }: { transfer: Data.Transfer }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="btn btn--secondary btn--sm inline-flex items-center gap-1.5 text-red-700 dark:text-red-400">
        <Trash2 size={14} /> Delete
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900">
          <Dialog.Title className="text-base font-medium">Delete this transfer?</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-neutral-500">
            <span className="font-medium break-all text-neutral-700 dark:text-neutral-300">
              {transfer.title}
            </span>{' '}
            will disappear for everyone, and its files can no longer be downloaded. This can&apos;t
            be undone.
          </Dialog.Description>
          <Form
            route="transfers.destroy"
            routeParams={{ id: transfer.id }}
            className="mt-4 flex justify-end gap-2"
          >
            {({ processing }) => (
              <>
                <Dialog.Close
                  type="button"
                  className="rounded-md px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={processing}
                  className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {processing && <LoaderCircle size={14} className="animate-spin" />}
                  Delete transfer
                </button>
              </>
            )}
          </Form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const BADGE_TONES = {
  neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
}

function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof BADGE_TONES
  children: ReactNode
}) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  )
}

ShowTransfer.layout = [AppLayout]
