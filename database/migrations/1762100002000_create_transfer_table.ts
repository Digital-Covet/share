import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A transfer groups uploaded files shared with a set of recipients.
 * File bytes live in object storage; only metadata is stored here.
 */
export default class extends BaseSchema {
  protected tableName = 'transfer'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.text('title').notNullable()
      table.text('message').nullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      /** NULL = unlimited */
      table.integer('max_downloads').nullable()
      /** NULL = no password; bcrypt/argon2 hash only */
      table.text('password_hash').nullable()
      table.uuid('created_by').notNullable().references('id').inTable('user')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.check(
        'max_downloads IS NULL OR max_downloads > 0',
        [],
        'transfer_max_downloads_positive'
      )
    })

    this.schema.raw(
      'CREATE INDEX transfer_created_by_idx ON transfer (created_by) WHERE deleted_at IS NULL'
    )
    this.schema.raw(
      'CREATE INDEX transfer_expires_at_idx ON transfer (expires_at) WHERE deleted_at IS NULL'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
