import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/queue'

/**
 * Background jobs (transfer cleanup, later notification emails). Jobs and
 * schedules live in Postgres (`queue_jobs`, `queue_schedules`) on the
 * default Lucid connection, so no extra infrastructure is needed. Tests use
 * `sync`, which runs a dispatched job inline.
 *
 * Run the worker with `pnpm worker` (`node ace queue:work`).
 */
export default defineConfig({
  default: env.get('QUEUE_DRIVER', 'database'),

  adapters: {
    database: drivers.database(),
    sync: drivers.sync(),
  },

  worker: {
    concurrency: 5,
    idleDelay: '2s',
  },

  locations: ['./app/jobs/**/*.{ts,js}'],
})
