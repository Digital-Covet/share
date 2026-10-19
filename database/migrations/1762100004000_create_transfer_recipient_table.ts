import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Users a transfer is shared with.
 */
export default class extends BaseSchema {
  protected tableName = 'transfer_recipient'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('transfer_id')
        .notNullable()
        .references('id')
        .inTable('transfer')
        .onDelete('CASCADE')
      table.uuid('user_id').notNullable().references('id').inTable('user')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['transfer_id', 'user_id'], { indexName: 'transfer_recipient_unique' })
      table.index(['user_id'], 'transfer_recipient_user_id_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
