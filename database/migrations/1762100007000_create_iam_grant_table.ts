import { BaseSchema } from '@adonisjs/lucid/schema'
import { uuidDefault } from '#database/uuid_default'

/**
 * One IAM refresh token per signed-in session. Kept server-side (not in the
 * cookie session) because IAM rotates the token on every refresh and revokes
 * the grant when a rotated token is replayed, so refreshes must be
 * serialised with a row lock.
 */
export default class extends BaseSchema {
  protected tableName = 'iam_grant'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(uuidDefault(this))
      table.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('refresh_token_encrypted').notNullable()
      table.timestamp('checked_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['user_id'], 'iam_grant_user_id_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
