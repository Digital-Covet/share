import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import CleanupService from '#services/cleanup_service'

/**
 * Runs the transfer cleanup once, outside the queue (the worker runs it
 * every 15 min). Safe to run alongside the scheduled job.
 */
export default class TransfersCleanup extends BaseCommand {
  static commandName = 'transfers:cleanup'
  static description = 'Soft-delete expired/abandoned transfers and delete their stored files'
  static options: CommandOptions = { startApp: true }

  async run() {
    const result = await CleanupService.run()
    this.logger.success(
      `expired: ${result.expired}, abandoned: ${result.abandoned}, ` +
        `files deleted: ${result.filesDeleted}, prefixes purged: ${result.prefixesPurged}`
    )
  }
}
