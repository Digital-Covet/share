import { type DateTime } from 'luxon'
import { BaseMail } from '@adonisjs/mail'
import env from '#start/env'
import type Transfer from '#models/transfer'
import type TransferFile from '#models/transfer_file'
import type User from '#models/user'

/**
 * Tells a creator that a recipient downloaded their transfer (sent on that
 * recipient's first successful download only). Links only to the detail
 * page. Expects `transfer.creator` preloaded.
 */
export default class TransferDownloadedNotification extends BaseMail {
  constructor(
    private transfer: Transfer,
    private file: TransferFile,
    private downloader: User,
    private downloadedAt: DateTime
  ) {
    super()
  }

  get url() {
    return new URL(`/transfers/${this.transfer.id}`, env.get('APP_URL')).toString()
  }

  prepare() {
    const creator = this.transfer.creator
    const downloader = this.downloader.name?.trim() || this.downloader.email
    const at = this.downloadedAt.toUTC().toFormat("d LLL yyyy, HH:mm 'UTC'")

    this.message
      .to(creator.email, creator.name ?? undefined)
      .subject(`${downloader} downloaded "${this.transfer.title}"`)
      .htmlView('emails/transfer_downloaded', {
        title: this.transfer.title,
        downloader,
        filename: this.file.filename,
        at,
        url: this.url,
      })
      .text(
        `${downloader} downloaded "${this.file.filename}" from "${this.transfer.title}" ` +
          `on CovetDrop at ${at}.\n\nSee all downloads: ${this.url}\n`
      )
  }
}
