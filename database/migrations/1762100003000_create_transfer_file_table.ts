import { BaseSchema } from '@adonisjs/lucid/schema'
import { uuidDefault } from '#database/uuid_default'

/**
 * One uploaded file within a transfer. `object_key` is its key/path in
 * object storage.
 */
export default class extends BaseSchema {
  protected tableName = 'transfer_file'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(uuidDefault(this))
      table
        .uuid('transfer_id')
        .notNullable()
        .references('id')
        .inTable('transfer')
        .onDelete('CASCADE')
      table.text('filename').notNullable()
      /** 1 byte .. 5 GiB */
      table.bigInteger('size_bytes').notNullable()
      table.text('mime_type').nullable()
      table.text('object_key').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.check(
        'size_bytes > 0 AND size_bytes <= 5368709120',
        [],
        'transfer_file_size_bytes_check'
      )
    })

    this.schema.raw(
      'CREATE INDEX transfer_file_transfer_id_idx ON transfer_file (transfer_id) WHERE deleted_at IS NULL'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
