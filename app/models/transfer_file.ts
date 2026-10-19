import { TransferFileSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { withSoftDeletes } from '#models/mixins/soft_deletes'
import Transfer from '#models/transfer'
import TransferDownload from '#models/transfer_download'

export default class TransferFile extends compose(TransferFileSchema, withSoftDeletes) {
  static table = 'transfer_file'

  @belongsTo(() => Transfer)
  declare transfer: BelongsTo<typeof Transfer>

  @hasMany(() => TransferDownload)
  declare downloads: HasMany<typeof TransferDownload>
}
