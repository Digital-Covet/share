import { TransferSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo, hasMany, manyToMany, scope, type BaseModel } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { withSoftDeletes } from '#models/mixins/soft_deletes'
import User from '#models/user'
import TransferFile from '#models/transfer_file'
import TransferRecipient from '#models/transfer_recipient'
import TransferDownload from '#models/transfer_download'

export default class Transfer extends compose(TransferSchema, withSoftDeletes) {
  static table = 'transfer'

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @hasMany(() => TransferFile)
  declare files: HasMany<typeof TransferFile>

  @hasMany(() => TransferRecipient)
  declare recipients: HasMany<typeof TransferRecipient>

  @manyToMany(() => User, {
    pivotTable: 'transfer_recipient',
    pivotForeignKey: 'transfer_id',
    pivotRelatedForeignKey: 'user_id',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare recipientUsers: ManyToMany<typeof User>

  @hasMany(() => TransferDownload)
  declare downloads: HasMany<typeof TransferDownload>

  /**
   * Transfers whose uploads were confirmed, i.e. `complete` wrote at least
   * one `transfer_file` row. There is no status column.
   */
  static confirmed = scope((query: ModelQueryBuilderContract<typeof BaseModel>) => {
    query.whereExists(
      db.from('transfer_file').whereColumn('transfer_file.transfer_id', 'transfer.id')
    )
  })

  get isExpired() {
    return this.expiresAt <= DateTime.now()
  }

  get hasPassword() {
    return this.passwordHash !== null
  }
}
