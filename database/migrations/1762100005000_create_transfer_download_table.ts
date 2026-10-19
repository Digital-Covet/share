import { BaseSchema } from '@adonisjs/lucid/schema'
import { uuidDefault } from '#database/uuid_default'

/**
 * Append-only download log. `transfer_file_id` is NULL for whole-transfer
 * downloads or once the file row is removed.
 */
export default class extends BaseSchema {
  protected tableName = 'transfer_download'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(uuidDefault(this))
      table
        .uuid('transfer_id')
        .notNullable()
        .references('id')
        .inTable('transfer')
        .onDelete('CASCADE')
      table
        .uuid('transfer_file_id')
        .nullable()
        .references('id')
        .inTable('transfer_file')
        .onDelete('SET NULL')
      table.uuid('user_id').notNullable().references('id').inTable('user')
      table.specificType('ip_address', 'inet').nullable()
      table.text('user_agent').nullable()
      table.timestamp('downloaded_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.boolean('success').notNullable().defaultTo(true)
    })

    this.schema.raw(
      'CREATE INDEX transfer_download_transfer_id_idx ON transfer_download (transfer_id, downloaded_at DESC)'
    )
    this.schema.raw(
      'CREATE INDEX transfer_download_user_id_idx ON transfer_download (user_id, downloaded_at DESC)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
