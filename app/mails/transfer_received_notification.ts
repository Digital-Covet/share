import { BaseMail } from '@adonisjs/mail'
import env from '#start/env'
import type Transfer from '#models/transfer'
import type User from '#models/user'

/**
 * Tells a recipient that a transfer is waiting for them. Links only to the
 * detail page (IAM sign-in required); never a file URL or the password.
 * Expects `transfer.creator` preloaded.
 */
export default class TransferReceivedNotification extends BaseMail {
  constructor(
    private transfer: Transfer,
    private recipient: User
  ) {
    super()
  }

  get url() {
    return new URL(`/transfers/${this.transfer.id}`, env.get('APP_URL')).toString()
  }

  prepare() {
    const sender = this.transfer.creator.name?.trim() || this.transfer.creator.email
    const expiresAt = this.transfer.expiresAt.toUTC().toFormat("d LLL yyyy, HH:mm 'UTC'")

    this.message
      .to(this.recipient.email, this.recipient.name ?? undefined)
      .subject(`${sender} sent you "${this.transfer.title}"`)
      .htmlView('emails/transfer_received', {
        title: this.transfer.title,
        sender,
        expiresAt,
        url: this.url,
      })
      .text(
        `${sender} sent you "${this.transfer.title}" on CovetDrop.\n\n` +
          `Available until ${expiresAt}.\n\nOpen it: ${this.url}\n`
      )
  }
}
