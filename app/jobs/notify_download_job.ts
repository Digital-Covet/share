import { DateTime } from 'luxon'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import Transfer from '#models/transfer'
import TransferFile from '#models/transfer_file'
import User from '#models/user'
import TransferDownloadedNotification from '#mails/transfer_downloaded_notification'

type Payload = { transferId: string; fileId: string; userId: string; downloadedAt: string }

/**
 * Emails the creator a receipt when a recipient first downloads their
 * transfer (dispatched by `DownloadService.authorize`). Skipped when the
 * transfer is gone or the creator downloaded it themselves.
 */
export default class NotifyDownloadJob extends Job<Payload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 2,
    timeout: '1m',
  }

  async execute() {
    const { transferId, fileId, userId, downloadedAt } = this.payload
    const transfer = await Transfer.query()
      .withScopes((s) => s.active())
      .where('id', transferId)
      .preload('creator')
      .first()
    if (!transfer || transfer.createdBy === userId) return

    const [file, downloader] = await Promise.all([TransferFile.find(fileId), User.find(userId)])
    if (!file || !downloader) return

    await mail.send(
      new TransferDownloadedNotification(transfer, file, downloader, DateTime.fromISO(downloadedAt))
    )
    logger.info({ transferId, userId }, 'notify: download receipt emailed')
  }

  async failed(error: Error) {
    logger.error(
      { err: error, transferId: this.payload.transferId },
      'notify: download receipt failed'
    )
  }
}
