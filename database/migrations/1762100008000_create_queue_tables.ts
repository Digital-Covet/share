import { BaseSchema } from '@adonisjs/lucid/schema'
import { KnexQueueSchemaService } from '@adonisjs/queue/drivers/knex_adapter'

/**
 * Storage for the `database` queue driver (`config/queue.ts`): pending and
 * running jobs, plus recurring schedules such as the transfer cleanup.
 */
export default class extends BaseSchema {
  async up() {
    const schemaService = new KnexQueueSchemaService(this.db.getWriteClient())

    await schemaService.createJobsTable()
    await schemaService.createSchedulesTable()
  }

  async down() {
    const schemaService = new KnexQueueSchemaService(this.db.getWriteClient())

    await schemaService.dropSchedulesTable()
    await schemaService.dropJobsTable()
  }
}
