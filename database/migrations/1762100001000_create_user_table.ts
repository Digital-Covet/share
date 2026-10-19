import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Local mirror of IAM identities. IAM (separate database) is the source of
 * truth; `id` is the IAM user uuid (OIDC `sub`) and is never generated here.
 * Rows are upserted when a user signs in through IAM.
 */
export default class extends BaseSchema {
  protected tableName = 'user'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.text('email').notNullable().unique()
      table.text('name').nullable()
      table.text('image').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
