import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import ExpiryReminderService from '#services/expiry_reminder_service'

/**
 * Scheduled "expires soon" reminders (`start/scheduler.ts`). The service
 * claims each transfer before sending, so a retry never reminds twice.
 */
export default class SendExpiryRemindersJob extends Job<Record<string, never>> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 2,
    timeout: '10m',
  }

  /** The service logs the counts (`reminder.run`). */
  async execute() {
    await ExpiryReminderService.run()
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'reminder: job failed')
  }
}
