import { BaseMail } from '@adonisjs/mail'
import env from '#start/env'
import type Transfer from '#models/transfer'
import type User from '#models/user'

/**
 * Reminds a recipient who hasn't downloaded a transfer yet that it expires
 * soon. Links only to the detail page. Expects `transfer.creator` preloaded.
 */
export default class TransferExpiringNotification extends BaseMail {
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
    const expiresIn = this.transfer.expiresAt.toRelative({ unit: 'hours' }) ?? 'soon'

    this.message
      .to(this.recipient.email, this.recipient.name ?? undefined)
      .subject(`"${this.transfer.title}" expires ${expiresIn}`)
      .htmlView('emails/transfer_expiring', {
        title: this.transfer.title,
        sender,
        expiresAt,
        url: this.url,
      })
      .text(
        `"${this.transfer.title}" from ${sender} expires on ${expiresAt} ` +
          `and you haven't downloaded it yet.\n\nOpen it: ${this.url}\n`
      )
  }
}
