import { TransferRecipientSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Transfer from '#models/transfer'
import User from '#models/user'

export default class TransferRecipient extends TransferRecipientSchema {
  static table = 'transfer_recipient'

  @belongsTo(() => Transfer)
  declare transfer: BelongsTo<typeof Transfer>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
