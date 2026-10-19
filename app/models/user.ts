import { UserSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Transfer from '#models/transfer'
import TransferRecipient from '#models/transfer_recipient'
import TransferDownload from '#models/transfer_download'

/**
 * Local mirror of an IAM identity. `id` is the IAM user uuid (OIDC `sub`),
 * upserted on sign-in; IAM remains the source of truth.
 */
export default class User extends UserSchema {
  static table = 'user'
  static selfAssignPrimaryKey = true

  @hasMany(() => Transfer, { foreignKey: 'createdBy' })
  declare transfers: HasMany<typeof Transfer>

  @hasMany(() => TransferRecipient)
  declare recipientEntries: HasMany<typeof TransferRecipient>

  @hasMany(() => TransferDownload)
  declare downloads: HasMany<typeof TransferDownload>

  get initials() {
    const source = this.name?.trim() || this.email.split('@')[0]
    const parts = source.split(/[\s._-]+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return source.slice(0, 2).toUpperCase()
  }
}
