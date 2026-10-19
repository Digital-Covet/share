import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import CleanupService from '#services/cleanup_service'

/**
 * Scheduled transfer cleanup (`start/scheduler.ts`). The service is
 * idempotent, so a retry after a partial run only finishes the rest.
 */
export default class CleanupTransfersJob extends Job<Record<string, never>> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 2,
    timeout: '10m',
  }

  /** The service logs the counts (`cleanup.run`). */
  async execute() {
    await CleanupService.run()
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'cleanup: job failed')
  }
}
