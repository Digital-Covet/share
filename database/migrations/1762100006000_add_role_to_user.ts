import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The user's IAM role name, mirrored from the `role` ID-token claim on
 * sign-in. No CHECK constraint: IAM admins can create custom role names.
 */
export default class extends BaseSchema {
  protected tableName = 'user'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('role').notNullable().defaultTo('employee')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('role')
    })
  }
}
