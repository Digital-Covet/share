import { router } from '@inertiajs/react'
import { Tabs } from '@base-ui/react/tabs'
import { Link } from '@adonisjs/inertia/react'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import Page from '~/components/page'
import AppLayout from '~/layouts/app'
import { urlFor } from '~/client'
import TransferList, { type TransferListItem } from '~/components/transfer_list'

type Tab = 'sent' | 'received' | 'all'

const TABS: { value: Tab; label: string; empty: string; adminOnly?: boolean }[] = [
  { value: 'sent', label: 'Sent', empty: "You haven't sent any transfers yet." },
  { value: 'received', label: 'Received', empty: 'Nobody has sent you a transfer yet.' },
  { value: 'all', label: 'All', empty: 'There are no transfers yet.', adminOnly: true },
]

const pagerClass =
  'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800'

/**
 * "Sent" and "Received" transfers (plus "All" for admins), 20 per page. The
 * tab and page live in the query string, so switching tabs is a server round
 * trip.
 */
export default function TransfersIndex({
  tab,
  canSeeAll,
  transfers,
  pagination,
}: {
  tab: Tab
  canSeeAll: boolean
  transfers: TransferListItem[]
  pagination: { currentPage: number; lastPage: number; perPage: number; total: number }
}) {
  const { currentPage, lastPage } = pagination
  const tabs = TABS.filter((t) => canSeeAll || !t.adminOnly)

  return (
    <Page
      title="Transfers"
      actions={
        <Link route="transfers.create" className="btn btn--primary btn--sm">
          <Send size={14} /> New transfer
        </Link>
      }
    >
      <Tabs.Root
        value={tab}
        onValueChange={(value) => router.visit(`${urlFor('transfers.index')}?tab=${value}`)}
        className="flex max-w-3xl flex-col gap-4"
      >
        <Tabs.List className="relative flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
          {tabs.map(({ value, label }) => (
            <Tabs.Tab
              key={value}
              value={value}
              className="px-3 py-2 text-sm text-neutral-500 data-[active]:font-medium data-[active]:text-neutral-900 dark:data-[active]:text-white"
            >
              {label}
            </Tabs.Tab>
          ))}
          <Tabs.Indicator className="absolute bottom-0 left-(--active-tab-left) h-0.5 w-(--active-tab-width) bg-neutral-900 transition-all dark:bg-white" />
        </Tabs.List>

        {tabs.map(({ value, empty }) => (
          <Tabs.Panel key={value} value={value} className="flex flex-col gap-3">
            {value === tab && (
              <>
                <TransferList transfers={transfers} showCreator={tab !== 'sent'} empty={empty} />
                {lastPage > 1 && (
                  <nav className="flex items-center justify-between" aria-label="Pagination">
                    {currentPage > 1 ? (
                      <Link
                        route="transfers.index"
                        qs={{ tab, page: currentPage - 1 }}
                        className={pagerClass}
                      >
                        <ChevronLeft size={15} /> Previous
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className="text-xs text-neutral-500">
                      Page {currentPage} of {lastPage}
                    </span>
                    {currentPage < lastPage ? (
                      <Link
                        route="transfers.index"
                        qs={{ tab, page: currentPage + 1 }}
                        className={pagerClass}
                      >
                        Next <ChevronRight size={15} />
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                )}
              </>
            )}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </Page>
  )
}

TransfersIndex.layout = [AppLayout]
