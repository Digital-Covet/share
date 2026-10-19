import { type ReactNode } from 'react'
import { type Data } from '@generated/data'
import { Link } from '@adonisjs/inertia/react'
import { formatBytes } from '~/components/file_upload_list'

export type TransferListItem = Data.Transfer.Variants['toListItem']

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
/** Luxon serializes dates as `string | null`; null never happens for these columns. */
const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : '')
const personLabel = (user: { name: string | null; email: string }) => user.name || user.email

/**
 * Transfers as linked rows: title, badges, sender (received lists only),
 * file count/size and expiry. Renders `empty` when there are none.
 */
export default function TransferList({
  transfers,
  showCreator,
  empty,
}: {
  transfers: TransferListItem[]
  showCreator: boolean
  empty: ReactNode
}) {
  if (transfers.length === 0) {
    return <p className="py-6 text-center text-sm text-neutral-500">{empty}</p>
  }

  return (
    <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {transfers.map((transfer) => (
        <li key={transfer.id}>
          <Link
            route="transfers.show"
            routeParams={{ id: transfer.id }}
            className="flex flex-col gap-1 px-3 py-2.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate font-medium" title={transfer.title}>
                {transfer.title}
              </span>
              {transfer.isExpired && <Badge tone="red">Expired</Badge>}
              {!transfer.isConfirmed && <Badge tone="amber">Upload not confirmed</Badge>}
            </span>
            <span className="flex flex-wrap gap-x-3 text-xs text-neutral-500">
              {showCreator && <span>From {personLabel(transfer.creator)}</span>}
              <span>
                {transfer.fileCount} {transfer.fileCount === 1 ? 'file' : 'files'}
                {transfer.fileCount > 0 && ` · ${formatBytes(transfer.totalBytes)}`}
              </span>
              <span>
                {transfer.isExpired ? 'Expired' : 'Expires'} {formatDate(transfer.expiresAt)}
              </span>
              {!showCreator && (
                <span>
                  {transfer.successfulDownloads}{' '}
                  {transfer.successfulDownloads === 1 ? 'download' : 'downloads'}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

const BADGE_TONES = {
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
}

function Badge({ tone, children }: { tone: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  )
}
