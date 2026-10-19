import db from '@adonisjs/lucid/services/db'
import Transfer from '#models/transfer'
import type User from '#models/user'

export type TransferTab = 'sent' | 'received' | 'all'

/** Non-deleted `transfer_file` rows of the outer `transfer` row. */
const fileRows = () =>
  db
    .from('transfer_file')
    .whereColumn('transfer_file.transfer_id', 'transfer.id')
    .whereNull('transfer_file.deleted_at')

/**
 * The "Sent" and "Received" lists. Each row carries its file count, total
 * bytes and successful-download count as `$extras` (computed with subqueries
 * in the same statement, so a page is one query plus the creator preload).
 *
 * - sent: every non-deleted transfer I created, confirmed or not
 * - received: non-deleted, confirmed transfers listing me as a recipient
 * - all (admins only; callers check): every non-deleted, confirmed transfer
 */
export default class TransferListService {
  static query(user: User, tab: TransferTab) {
    const query = Transfer.query()
      .withScopes((s) => s.active())
      .select('transfer.*')
      .select(fileRows().count('*').as('file_count'))
      .select(fileRows().sum('transfer_file.size_bytes').as('total_bytes'))
      .withCount('downloads', (downloads) => downloads.where('success', true))
      .preload('creator')
      .orderBy('transfer.created_at', 'desc')
      .orderBy('transfer.id', 'desc')

    if (tab === 'sent') return query.where('transfer.created_by', user.id)
    if (tab === 'all') return query.withScopes((s) => s.confirmed())
    return query
      .withScopes((s) => s.confirmed())
      .whereHas('recipients', (recipients) => recipients.where('user_id', user.id))
  }

  /** One page of a tab, 20 per page. */
  static paginate(user: User, tab: TransferTab, page: number) {
    return this.query(user, tab).paginate(page, 20)
  }

  /** The `limit` most recent transfers of a tab, for the dashboard. */
  static latest(user: User, tab: TransferTab, limit = 5) {
    return this.query(user, tab).limit(limit)
  }
}
