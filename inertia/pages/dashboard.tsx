import { type ReactNode } from 'react'
import Page from '~/components/page'
import { Inbox, Send } from 'lucide-react'
import { Link } from '@adonisjs/inertia/react'
import AppLayout from '~/layouts/app'
import TransferList, { type TransferListItem } from '~/components/transfer_list'

/** The 5 latest sent and received transfers, or a first-run empty state. */
export default function Dashboard({
  sent,
  received,
}: {
  sent: TransferListItem[]
  received: TransferListItem[]
}) {
  if (sent.length === 0 && received.length === 0) {
    return (
      <Page title="Dashboard" hideTitle>
        <div className="empty">
          <div className="empty__mark">
            <Inbox size={22} />
          </div>
          <h1>No transfers yet</h1>
          <p>Files you send and files colleagues send you will show up here.</p>
          <Link route="transfers.create" className="btn btn--primary btn--sm">
            <Send size={14} /> New transfer
          </Link>
        </div>
      </Page>
    )
  }

  return (
    <Page
      title="Dashboard"
      actions={
        <Link route="transfers.create" className="btn btn--primary btn--sm">
          <Send size={14} /> New transfer
        </Link>
      }
    >
      <div className="grid max-w-5xl gap-8 lg:grid-cols-2">
        <RecentSection title="Received" tab="received">
          <TransferList
            transfers={received}
            showCreator
            empty="Nobody has sent you a transfer yet."
          />
        </RecentSection>
        <RecentSection title="Sent" tab="sent">
          <TransferList
            transfers={sent}
            showCreator={false}
            empty="You haven't sent any transfers yet."
          />
        </RecentSection>
      </div>
    </Page>
  )
}

function RecentSection({
  title,
  tab,
  children,
}: {
  title: string
  tab: 'sent' | 'received'
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <Link
          route="transfers.index"
          qs={{ tab }}
          className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          View all
        </Link>
      </header>
      {children}
    </section>
  )
}

Dashboard.layout = [AppLayout]
