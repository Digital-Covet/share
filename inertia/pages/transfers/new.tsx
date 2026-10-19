import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { router } from '@inertiajs/react'
import { toast } from '~/components/ui/toaster'
import { RotateCcw, Upload } from 'lucide-react'
import Page from '~/components/page'
import AppLayout from '~/layouts/app'
import { urlFor } from '~/client'
import { putWithProgress } from '~/lib/upload'
import RecipientPicker, { type Recipient } from '~/components/recipient_picker'
import FileUploadList, { formatBytes, type UploadItem } from '~/components/file_upload_list'

/* Mirrors `createTransferValidator`; the server re-checks everything. */
const MAX_FILES = 20
const MAX_RECIPIENTS = 50
const MAX_EXPIRY_DAYS = 30
const DEFAULT_EXPIRY_DAYS = 7
const UPLOAD_CONCURRENCY = 3
const DAY_MS = 24 * 60 * 60 * 1000

type Field =
  'title' | 'message' | 'expiresAt' | 'maxDownloads' | 'password' | 'recipientIds' | 'files'
type Errors = Partial<Record<Field, string>>

/**
 * idle → creating (POST /transfers) → uploading (PUTs to storage) →
 * completing (POST /transfers/:id/complete) → done. `failed` keeps the
 * created transfer so failed files can be re-PUT to the same URLs;
 * `expired` means the upload token was rejected and only starting over helps.
 */
type Phase = 'idle' | 'creating' | 'uploading' | 'completing' | 'failed' | 'expired' | 'done'

type Created = {
  transferId: string
  uploadToken: string
  /** Presigned PUT per client file key. */
  uploads: Map<string, { fileId: string; url: string; headers: Record<string, string> }>
}

type CreateResponse = {
  transferId: string
  uploadToken: string
  uploads: Array<{ fileId: string; url: string; method: 'PUT'; headers: Record<string, string> }>
}

/** `<input type="datetime-local">` value for a Date, in local time. */
const toLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** Shield's XSRF-TOKEN cookie, echoed back as the X-XSRF-TOKEN header. */
const xsrfToken = () => {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

/** JSON POST to a Share REST endpoint. Throws only on network errors. */
async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': xsrfToken(),
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  return { status: response.status, data }
}

const inputClass =
  'w-full rounded-md border bg-white px-2.5 py-1.5 text-sm outline-none focus:outline-2 focus:outline-neutral-900 disabled:opacity-60 dark:bg-neutral-950 dark:focus:outline-white'
const buttonClass =
  'btn btn--primary inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200'
const borderClass = (error?: string) =>
  error ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-700'

export default function NewTransfer({ maxFileBytes }: { maxFileBytes: number }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [expiresAt, setExpiresAt] = useState(() =>
    toLocalInput(new Date(Date.now() + DEFAULT_EXPIRY_DAYS * DAY_MS))
  )
  // Picker hints only, fixed at page load; `validate` checks against the current time.
  const [expiryBounds] = useState(() => ({
    min: toLocalInput(new Date()),
    max: toLocalInput(new Date(Date.now() + MAX_EXPIRY_DAYS * DAY_MS)),
  }))
  const [maxDownloads, setMaxDownloads] = useState('')
  const [password, setPassword] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [items, setItems] = useState<UploadItem[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [dragging, setDragging] = useState(false)

  const [phase, setPhaseState] = useState<Phase>('idle')
  // Read by the navigation guards, which would otherwise see a stale phase.
  const phaseRef = useRef<Phase>('idle')
  const setPhase = (next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }

  // Upload token lives in component state only (never localStorage).
  const createdRef = useRef<Created | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const locked = phase !== 'idle'

  /** Leaving after the transfer exists abandons it (purged after 24 h). */
  useEffect(() => {
    const busy = () =>
      createdRef.current !== null && !['done', 'expired'].includes(phaseRef.current)
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (busy()) event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    const removeRouterGuard = router.on('before', (event) => {
      if (busy() && !window.confirm('Uploads are not finished. Leave this page anyway?')) {
        event.preventDefault()
      }
    })
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      removeRouterGuard()
    }
  }, [])

  const updateItem = (key: string, patch: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))

  const addFiles = (list: FileList | null) => {
    if (!list || locked) return
    const added = Array.from(list).map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: 'queued' as const,
      loaded: 0,
    }))
    setItems((current) => [...current, ...added])
    setErrors((current) => ({ ...current, files: undefined }))
  }

  const validate = (): Errors => {
    const found: Errors = {}
    if (!title.trim()) found.title = 'Enter a title'
    else if (title.trim().length > 200) found.title = 'Keep the title under 200 characters'
    if (message.trim().length > 5000) found.message = 'Keep the message under 5000 characters'

    const expiry = new Date(expiresAt).getTime()
    if (Number.isNaN(expiry)) found.expiresAt = 'Pick an expiry date'
    else if (expiry <= Date.now()) found.expiresAt = 'The expiry must be in the future'
    else if (expiry > Date.now() + MAX_EXPIRY_DAYS * DAY_MS)
      found.expiresAt = `The expiry must be within ${MAX_EXPIRY_DAYS} days`

    if (maxDownloads && !(Number.isInteger(Number(maxDownloads)) && Number(maxDownloads) >= 1))
      found.maxDownloads = 'Enter a whole number of at least 1'
    if (password && (password.length < 8 || password.length > 128))
      found.password = 'Passwords must be 8 to 128 characters'

    if (recipients.length === 0) found.recipientIds = 'Add at least one recipient'
    else if (recipients.length > MAX_RECIPIENTS)
      found.recipientIds = `At most ${MAX_RECIPIENTS} recipients`

    if (items.length === 0) found.files = 'Attach at least one file'
    else if (items.length > MAX_FILES) found.files = `At most ${MAX_FILES} files per transfer`
    else {
      const tooBig = items.find((i) => i.file.size > maxFileBytes)
      const empty = items.find((i) => i.file.size === 0)
      const longName = items.find((i) => i.file.name.length > 255)
      if (tooBig)
        found.files = `${tooBig.file.name} is larger than the ${formatBytes(maxFileBytes)} limit`
      else if (empty) found.files = `${empty.file.name} is empty`
      else if (longName) found.files = `${longName.file.name} has a name longer than 255 characters`
    }
    return found
  }

  /** PUT the given files, at most UPLOAD_CONCURRENCY at a time. Resolves true if all succeeded. */
  const uploadFiles = async (targets: UploadItem[]) => {
    const created = createdRef.current!
    let next = 0
    let failures = 0
    const worker = async () => {
      while (next < targets.length) {
        const { key, file } = targets[next++]
        const upload = created.uploads.get(key)!
        updateItem(key, { status: 'uploading', loaded: 0, error: undefined })
        try {
          await putWithProgress(upload.url, file, upload.headers, (loaded) =>
            updateItem(key, { loaded })
          )
          updateItem(key, { status: 'done' })
        } catch (error) {
          failures++
          updateItem(key, { status: 'failed', error: (error as Error).message })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, targets.length) }, worker))
    return failures === 0
  }

  /** Confirm the uploads. Idempotent on the server, so retrying is safe. */
  const complete = async () => {
    const created = createdRef.current!
    setPhase('completing')
    let result: Awaited<ReturnType<typeof postJson>>
    try {
      result = await postJson(urlFor('transfers.complete', { id: created.transferId }), {
        uploadToken: created.uploadToken,
      })
    } catch {
      setPhase('failed')
      toast.error("Couldn't confirm the upload. Check your connection and retry.")
      return
    }

    if (result.status === 200) {
      setPhase('done')
      toast.success('Transfer sent')
      router.visit(urlFor('transfers.show', { id: created.transferId }))
    } else if (result.status === 409) {
      const fileIds = new Set<string>(result.data?.fileIds ?? [])
      const reason =
        result.data?.error === 'size_mismatch'
          ? 'Stored size differs from the file. Retry the upload.'
          : 'The file did not reach storage. Retry the upload.'
      for (const [key, upload] of created.uploads) {
        if (fileIds.has(upload.fileId)) updateItem(key, { status: 'failed', error: reason })
      }
      setPhase('failed')
      toast.error('Some files did not reach storage')
    } else if (result.status === 422) {
      setPhase('expired')
      toast.error('This upload session has expired. Start a new transfer.')
    } else {
      setPhase('failed')
      toast.error(`Couldn't confirm the upload (HTTP ${result.status}). Retry.`)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (locked) return

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setPhase('creating')
    let result: Awaited<ReturnType<typeof postJson>>
    try {
      result = await postJson(urlFor('transfers.store'), {
        title: title.trim(),
        message: message.trim() || null,
        expiresAt: new Date(expiresAt).toISOString(),
        maxDownloads: maxDownloads ? Number(maxDownloads) : null,
        password: password || null,
        recipientIds: recipients.map((r) => r.id),
        files: items.map(({ file }) => ({
          filename: file.name,
          sizeBytes: file.size,
          mimeType: file.type || null,
        })),
      })
    } catch {
      setPhase('idle')
      toast.error("Couldn't reach Share. Check your connection and try again.")
      return
    }

    if (result.status === 422) {
      const serverErrors: Errors = {}
      for (const { field, message: text } of result.data?.errors ?? []) {
        const name = String(field).split('.')[0] as Field
        serverErrors[name] ??= text
      }
      setErrors(serverErrors)
      setPhase('idle')
      return
    }
    if (result.status !== 201) {
      setPhase('idle')
      toast.error(`Couldn't create the transfer (HTTP ${result.status})`)
      return
    }

    const data = result.data as CreateResponse
    // `uploads` is in the same order as the `files` we sent.
    createdRef.current = {
      transferId: data.transferId,
      uploadToken: data.uploadToken,
      uploads: new Map(items.map((item, i) => [item.key, data.uploads[i]])),
    }

    setPhase('uploading')
    if (await uploadFiles(items)) {
      await complete()
    } else {
      setPhase('failed')
      toast.error('Some files failed to upload')
    }
  }

  const retryFailed = async () => {
    const failed = items.filter((item) => item.status !== 'done')
    setPhase('uploading')
    if (failed.length === 0 || (await uploadFiles(failed))) {
      await complete()
    } else {
      setPhase('failed')
      toast.error('Some files still failed to upload')
    }
  }

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0)

  return (
    <Page
      title="New transfer"
      description="Files upload straight to storage. Only the colleagues you pick can download them."
    >
      <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-5">
        <FormField id="title" label="Title" error={errors.title}>
          <input
            id="title"
            className={`${inputClass} ${borderClass(errors.title)}`}
            value={title}
            maxLength={200}
            disabled={locked}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>

        <FormField id="message" label="Message" hint="Optional" error={errors.message}>
          <textarea
            id="message"
            rows={3}
            className={`${inputClass} ${borderClass(errors.message)}`}
            value={message}
            maxLength={5000}
            disabled={locked}
            onChange={(e) => setMessage(e.target.value)}
          />
        </FormField>

        <FormField id="recipients" label="Recipients" error={errors.recipientIds}>
          <RecipientPicker
            id="recipients"
            value={recipients}
            disabled={locked}
            invalid={!!errors.recipientIds}
            onChange={(next) => {
              setRecipients(next)
              setErrors((current) => ({ ...current, recipientIds: undefined }))
            }}
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField id="expiresAt" label="Expires" error={errors.expiresAt}>
            <input
              id="expiresAt"
              type="datetime-local"
              className={`${inputClass} ${borderClass(errors.expiresAt)}`}
              value={expiresAt}
              min={expiryBounds.min}
              max={expiryBounds.max}
              disabled={locked}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </FormField>
          <FormField
            id="maxDownloads"
            label="Download limit"
            hint="Optional"
            error={errors.maxDownloads}
          >
            <input
              id="maxDownloads"
              type="number"
              min={1}
              step={1}
              placeholder="Unlimited"
              className={`${inputClass} ${borderClass(errors.maxDownloads)}`}
              value={maxDownloads}
              disabled={locked}
              onChange={(e) => setMaxDownloads(e.target.value)}
            />
          </FormField>
          <FormField id="password" label="Password" hint="Optional" error={errors.password}>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className={`${inputClass} ${borderClass(errors.password)}`}
              value={password}
              disabled={locked}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
        </div>

        <FormField
          id="files"
          label="Files"
          hint={`Up to ${MAX_FILES} files, ${formatBytes(maxFileBytes)} each`}
          error={errors.files}
        >
          {!locked && (
            <div
              className={`flex flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center text-sm ${dragging ? 'border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-900' : borderClass(errors.files)}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                addFiles(e.dataTransfer.files)
              }}
            >
              <Upload size={18} className="text-neutral-500" />
              <span>
                Drop files here or{' '}
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse
                </button>
              </span>
              <input
                id="files"
                ref={fileInputRef}
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>
          )}
          <FileUploadList
            items={items}
            onRemove={
              locked ? undefined : (key) => setItems((all) => all.filter((i) => i.key !== key))
            }
          />
          {items.length > 0 && (
            <p className="text-xs text-neutral-500">
              {items.length} {items.length === 1 ? 'file' : 'files'} · {formatBytes(totalBytes)}
            </p>
          )}
        </FormField>

        <div className="flex items-center gap-3">
          {phase === 'failed' ? (
            <button type="button" className={buttonClass} onClick={retryFailed}>
              <RotateCcw size={15} /> Retry failed
            </button>
          ) : phase === 'expired' ? (
            <a href={urlFor('transfers.create')} className={buttonClass}>
              Start a new transfer
            </a>
          ) : (
            <button type="submit" className={buttonClass} disabled={locked}>
              {SUBMIT_LABELS[phase]}
            </button>
          )}
        </div>
      </form>
    </Page>
  )
}

const SUBMIT_LABELS: Record<Phase, string> = {
  idle: 'Send transfer',
  creating: 'Creating…',
  uploading: 'Uploading…',
  completing: 'Confirming…',
  failed: 'Retry failed',
  expired: 'Start a new transfer',
  done: 'Sent',
}

function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {hint && <span className="ml-1.5 font-normal text-neutral-500">{hint}</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

NewTransfer.layout = [AppLayout]
