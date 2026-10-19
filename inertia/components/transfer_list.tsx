import { type ReactNode } from 'react'
import { type Data } from '@generated/data'
import { Link } from '@adonisjs/inertia/react'
import { CircleSlash, CloudAlert } from 'lucide-react'
import { Tip } from '~/components/ui/tooltip'
import { UserAvatar } from '~/components/ui/avatar'
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
    return <p className="manifest__empty">{empty}</p>
  }

  return (
    <ul className="manifest-list">
      {transfers.map((transfer) => (
        <li key={transfer.id}>
          <Link route="transfers.show" routeParams={{ id: transfer.id }} className="manifest-row">
            <span className="manifest-row__top">
              <Tip label={transfer.title} side="top">
                <span className="manifest-row__title">{transfer.title}</span>
              </Tip>
              {transfer.isExpired && (
                <Badge tone="red" icon={<CircleSlash size={11} aria-hidden="true" />}>
                  Expired
                </Badge>
              )}
              {!transfer.isConfirmed && (
                <Badge tone="amber" icon={<CloudAlert size={11} aria-hidden="true" />}>
                  Upload not confirmed
                </Badge>
              )}
            </span>
            <span className="manifest-row__meta">
              {showCreator && (
                <span className="manifest-row__from">
                  <UserAvatar user={transfer.creator} />
                  From {personLabel(transfer.creator)}
                </span>
              )}
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
  red: 'stamp--danger',
  amber: 'stamp--warn',
}

function Badge({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof BADGE_TONES
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <span className={`stamp label-mono ${BADGE_TONES[tone]}`}>
      {icon}
      {children}
    </span>
  )
}
