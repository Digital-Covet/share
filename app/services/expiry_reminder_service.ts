import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import Transfer from '#models/transfer'
import TransferExpiringNotification from '#mails/transfer_expiring_notification'
import env from '#start/env'

const BATCH_SIZE = 100
/** Remind when a transfer expires within this window... */
const REMIND_BEFORE = { hours: 24 }
/** ...but only if it's older than this, so it doesn't follow the "received" email. */
const MIN_AGE = { hours: 24 }

export type ExpiryReminderResult = { transfers: number; emails: number }

/**
 * Emails recipients who haven't downloaded a transfer yet that it expires
 * within 24 hours. Each transfer is claimed by setting
 * `expiry_reminder_sent_at` with a conditional UPDATE before any email goes
 * out, so concurrent runs and retries never remind twice; a send failure
 * after the claim is logged and not retried. Run by `SendExpiryRemindersJob`.
 */
export default class ExpiryReminderService {
  static async run(): Promise<ExpiryReminderResult> {
    const result = { transfers: 0, emails: 0 }
    if (!env.get('MAIL_ENABLED', false)) return result

    const now = DateTime.now()
    const format = db.connection().dialect.dateTimeFormat
    const candidates = await Transfer.query()
      .withScopes((s) => {
        s.active()
        s.confirmed()
      })
      .whereNull('expiry_reminder_sent_at')
      .where('expires_at', '>', now.toFormat(format))
      .where('expires_at', '<=', now.plus(REMIND_BEFORE).toFormat(format))
      .where('created_at', '<', now.minus(MIN_AGE).toFormat(format))
      .orderBy('expires_at')
      .limit(BATCH_SIZE)

    for (const transfer of candidates) {
      const claimed = await db
        .from('transfer')
        .where('id', transfer.id)
        .whereNull('expiry_reminder_sent_at')
        .update({ expiry_reminder_sent_at: DateTime.now().toFormat(format) })
      if (Number(claimed) === 0) continue
      result.transfers++

      try {
        result.emails += await this.remind(transfer)
      } catch (error) {
        logger.error({ err: error, transferId: transfer.id }, 'reminder: send failed')
      }
    }

    logger.info({ event: 'reminder.run', ...result }, 'reminder.run')
    return result
  }

  /** Email every recipient without a successful download. */
  private static async remind(transfer: Transfer): Promise<number> {
    await transfer.load('creator')
    await transfer.load('recipientUsers', (query) =>
      query.whereNotExists(
        db
          .from('transfer_download')
          .whereColumn('transfer_download.user_id', 'user.id')
          .where('transfer_download.transfer_id', transfer.id)
          .where('transfer_download.success', true)
      )
    )
    for (const recipient of transfer.recipientUsers) {
      await mail.send(new TransferExpiringNotification(transfer, recipient))
    }
    return transfer.recipientUsers.length
  }
}
