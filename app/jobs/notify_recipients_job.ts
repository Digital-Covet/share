import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import Transfer from '#models/transfer'
import TransferReceivedNotification from '#mails/transfer_received_notification'

/**
 * Emails every recipient of a transfer once its uploads are first confirmed
 * (dispatched by `TransferService.complete`). A transfer deleted in the
 * meantime is skipped. A retry resends to everyone, so a recipient may get a
 * duplicate after a partial failure; that beats losing the notice.
 */
export default class NotifyRecipientsJob extends Job<{ transferId: string }> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 2,
    timeout: '2m',
  }

  async execute() {
    const transfer = await Transfer.query()
      .withScopes((s) => s.active())
      .where('id', this.payload.transferId)
      .preload('creator')
      .preload('recipientUsers')
      .first()
    if (!transfer) return

    for (const recipient of transfer.recipientUsers) {
      await mail.send(new TransferReceivedNotification(transfer, recipient))
    }
    logger.info(
      { transferId: transfer.id, recipients: transfer.recipientUsers.length },
      'notify: recipients emailed'
    )
  }

  async failed(error: Error) {
    logger.error({ err: error, transferId: this.payload.transferId }, 'notify: job failed')
  }
}
