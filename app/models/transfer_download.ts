import { TransferDownloadSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Transfer from '#models/transfer'
import TransferFile from '#models/transfer_file'
import User from '#models/user'

export default class TransferDownload extends TransferDownloadSchema {
  static table = 'transfer_download'

  @belongsTo(() => Transfer)
  declare transfer: BelongsTo<typeof Transfer>

  @belongsTo(() => TransferFile, { foreignKey: 'transferFileId' })
  declare file: BelongsTo<typeof TransferFile>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
