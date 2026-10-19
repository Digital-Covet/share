import { IamGrantSchema } from '#database/schema'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import encryption from '@adonisjs/core/services/encryption'
import User from '#models/user'

const PURPOSE = 'iam-refresh-token'

/**
 * The IAM refresh token behind one signed-in session (its id is the
 * session's `iam_grant_id`). Stored encrypted; `checked_at` is when IAM last
 * confirmed the user's access.
 */
export default class IamGrant extends IamGrantSchema {
  static table = 'iam_grant'
  static selfAssignPrimaryKey = true

  @column({ serializeAs: null })
  declare refreshTokenEncrypted: string

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  /** Encrypt a refresh token for the `refresh_token_encrypted` column. */
  static seal(refreshToken: string): string {
    return encryption.encrypt(refreshToken, undefined, PURPOSE)
  }

  /** The plaintext refresh token, or `null` if the column can't be decrypted. */
  static open(encrypted: string): string | null {
    try {
      return encryption.decrypt<string>(encrypted, PURPOSE)
    } catch {
      return null
    }
  }
}
