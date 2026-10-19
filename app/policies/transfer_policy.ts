import db from '@adonisjs/lucid/services/db'
import Transfer from '#models/transfer'
import type User from '#models/user'

/** `transfer_file` rows of the outer `transfer` row: it's confirmed. */
const fileRows = () =>
  db.from('transfer_file').whereColumn('transfer_file.transfer_id', 'transfer.id')

/** `user` is listed as a recipient of the outer `transfer` row. */
const recipientRow = (user: User) =>
  db
    .from('transfer_recipient')
    .whereColumn('transfer_recipient.transfer_id', 'transfer.id')
    .where('transfer_recipient.user_id', user.id)

/**
 * Who may see and download a transfer. Each check is a single query over
 * non-deleted transfers; callers answer 404 (never 403) on `false` so a
 * transfer's existence isn't revealed.
 *
 * - view: creator, or a recipient or admin once the upload is confirmed
 * - download: creator or recipient, once the upload is confirmed (never admins)
 * - delete: creator, or an admin once the upload is confirmed
 */
export default class TransferPolicy {
  /** Non-deleted transfers `user` may view. */
  static viewable(user: User) {
    return Transfer.query()
      .withScopes((s) => s.active())
      .where((q) => {
        q.where('transfer.created_by', user.id).orWhere((sub) => {
          sub.whereExists(fileRows())
          if (!user.isAdmin) sub.whereExists(recipientRow(user))
        })
      })
  }

  /** Non-deleted transfers `user` may delete. */
  static deletable(user: User) {
    return Transfer.query()
      .withScopes((s) => s.active())
      .where((q) => {
        q.where('transfer.created_by', user.id)
        if (user.isAdmin) q.orWhereExists(fileRows())
      })
  }

  /** Non-deleted, confirmed transfers `user` may download from. */
  static downloadable(user: User) {
    return Transfer.query()
      .withScopes((s) => s.active())
      .withScopes((s) => s.confirmed())
      .where((q) => {
        q.where('transfer.created_by', user.id).orWhereExists(recipientRow(user))
      })
  }

  static async canView(user: User, transfer: Transfer): Promise<boolean> {
    return (await this.viewable(user).where('transfer.id', transfer.id).first()) !== null
  }

  static async canDownload(user: User, transfer: Transfer): Promise<boolean> {
    return (await this.downloadable(user).where('transfer.id', transfer.id).first()) !== null
  }

  static async canDelete(user: User, transfer: Transfer): Promise<boolean> {
    return (await this.deletable(user).where('transfer.id', transfer.id).first()) !== null
  }

  /** The transfer, or a 404 when it doesn't exist, is deleted, or `user` may not view it. */
  static async findViewableOrFail(user: User, id: string): Promise<Transfer> {
    return this.viewable(user).where('transfer.id', id).firstOrFail()
  }
}
