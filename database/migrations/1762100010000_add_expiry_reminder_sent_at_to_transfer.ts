import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * When the "expires soon" reminder went out. NULL = not sent yet; set before
 * sending, so each transfer is reminded at most once.
 */
export default class extends BaseSchema {
  protected tableName = 'transfer'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('expiry_reminder_sent_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('expiry_reminder_sent_at')
    })
  }
}
