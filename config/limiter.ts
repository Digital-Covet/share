import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'

const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE'),
  stores: {
    /**
     * Shared across replicas: counters live in the `rate_limits` table
     * (Postgres). Every real environment uses this store.
     */
    database: stores.database({
      tableName: 'rate_limits',
      clearExpiredByTimeout: true,
    }),
    /**
     * Per-process counters, for tests.
     */
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
