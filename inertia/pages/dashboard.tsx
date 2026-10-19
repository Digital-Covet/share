import { type ReactNode } from 'react'
import Page from '~/components/page'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Send } from 'lucide-react'
import { Link } from '@adonisjs/inertia/react'
import { Separator } from '@base-ui/react/separator'
import AppLayout from '~/layouts/app'
import DispatchLabel from '~/components/dispatch_label'
import { buttonClass } from '~/components/ui/button'
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
          <div className="empty__label">
            <DispatchLabel />
          </div>
          <h1>No transfers yet</h1>
          <p>Files you send and files colleagues send you will show up here.</p>
          <Link
            route="transfers.create"
            className={buttonClass({ variant: 'primary', size: 'sm' })}
          >
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
        <Link route="transfers.create" className={buttonClass({ variant: 'primary', size: 'sm' })}>
          <Send size={14} /> New transfer
        </Link>
      }
    >
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <RecentSection
          title="Received"
          tab="received"
          icon={<ArrowDownLeft size={14} aria-hidden="true" />}
        >
          <TransferList
            transfers={received}
            showCreator
            empty="Nobody has sent you a transfer yet."
          />
        </RecentSection>
        <RecentSection title="Sent" tab="sent" icon={<ArrowUpRight size={14} aria-hidden="true" />}>
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
  icon,
  children,
}: {
  title: string
  tab: 'sent' | 'received'
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="manifest">
      <header className="manifest__head">
        <h2 className="manifest__title label-mono">
          {icon}
          {title}
        </h2>
        <Link route="transfers.index" qs={{ tab }} className="manifest__more">
          View all <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </header>
      <Separator className="manifest__rule" />
      {children}
    </section>
  )
}

Dashboard.layout = [AppLayout]
