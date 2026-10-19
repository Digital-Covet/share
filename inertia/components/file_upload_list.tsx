import { CircleAlert, CircleCheck, File as FileIcon, LoaderCircle, X } from 'lucide-react'

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed'

export type UploadItem = {
  /** Client-side key; the server's file id is only known after `POST /transfers`. */
  key: string
  file: File
  status: UploadStatus
  loaded: number
  error?: string
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** 1536 → "1.5 KB". Binary multiples, matching how the size cap is defined. */
export function formatBytes(bytes: number) {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${UNITS[unit]}`
}

/**
 * Selected files with per-file progress. Files can be removed only before
 * the transfer is created (`onRemove` omitted afterwards).
 */
export default function FileUploadList({
  items,
  onRemove,
}: {
  items: UploadItem[]
  onRemove?: (key: string) => void
}) {
  if (items.length === 0) return null

  return (
    <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {items.map((item) => {
        const percent = item.file.size ? Math.round((item.loaded / item.file.size) * 100) : 0
        return (
          <li key={item.key} className="flex flex-col gap-1.5 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <StatusIcon status={item.status} />
              <span className="min-w-0 flex-1 truncate" title={item.file.name}>
                {item.file.name}
              </span>
              <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                {item.status === 'uploading' ? `${percent}% · ` : ''}
                {formatBytes(item.file.size)}
              </span>
              {onRemove && (
                <button
                  type="button"
                  className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => onRemove(item.key)}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {(item.status === 'uploading' || item.status === 'done') && (
              <div
                className="h-1 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
                role="progressbar"
                aria-label={`Upload progress for ${item.file.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div
                  className={`h-full transition-[width] ${item.status === 'done' ? 'bg-emerald-500' : 'bg-neutral-900 dark:bg-white'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
            {item.status === 'failed' && item.error && (
              <p className="text-xs text-red-600 dark:text-red-400">{item.error}</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function StatusIcon({ status }: { status: UploadStatus }) {
  switch (status) {
    case 'uploading':
      return <LoaderCircle size={15} className="shrink-0 animate-spin text-neutral-500" />
    case 'done':
      return <CircleCheck size={15} className="shrink-0 text-emerald-600" />
    case 'failed':
      return <CircleAlert size={15} className="shrink-0 text-red-600" />
    default:
      return <FileIcon size={15} className="shrink-0 text-neutral-400" />
  }
}
