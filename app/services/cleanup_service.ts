import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { DatabaseQueryBuilderContract } from '@adonisjs/lucid/types/querybuilder'
import { DateTime } from 'luxon'
import StorageService from '#services/storage_service'

const BATCH_SIZE = 100
const ABANDONED_AFTER = { hours: 24 }
const PURGE_WINDOW = { days: 7 }

export type CleanupResult = {
  expired: number
  abandoned: number
  filesDeleted: number
  prefixesPurged: number
}

/** A timestamp in the format Lucid writes for the client's dialect. */
const sqlTime = (client: QueryClientContract, value: DateTime) =>
  value.toFormat(client.dialect.dateTimeFormat)

/** Row locks that other cleanup runs skip; SQLite (tests) has none. */
const lockBatch = (client: QueryClientContract, query: DatabaseQueryBuilderContract) =>
  query.if(client.dialect.name === 'postgres', (q) => q.forUpdate().skipLocked())

const hasFiles = () =>
  db
    .from('transfer_file')
    .select(db.raw('1'))
    .whereColumn('transfer_file.transfer_id', 'transfer.id')

/**
 * Removes what users no longer need: expired transfers, uploads that were
 * never confirmed, and the stored bytes of every soft-deleted transfer.
 * DB rows are only soft-deleted (they're the audit trail). Each batch locks
 * its rows with `SKIP LOCKED`, so concurrent runs split the work instead of
 * repeating it. Run by `CleanupTransfersJob` and `node ace transfers:cleanup`.
 */
export default class CleanupService {
  static async run(): Promise<CleanupResult> {
    const now = DateTime.now()

    const expired = await this.softDeleteTransfers(now, (query, client) =>
      query.where('expires_at', '<', sqlTime(client, now))
    )
    const abandoned = await this.softDeleteTransfers(now, (query, client) =>
      query
        .whereNotExists(hasFiles())
        .where('created_at', '<', sqlTime(client, now.minus(ABANDONED_AFTER)))
    )
    const filesDeleted = await this.deleteFiles()
    const prefixesPurged = await this.purgeUnconfirmedPrefixes(now)

    const result = { expired, abandoned, filesDeleted, prefixesPurged }
    logger.info({ event: 'cleanup.run', ...result }, 'cleanup.run')
    return result
  }

  /** Sets `deleted_at` on active transfers matching `where`, in batches. */
  private static async softDeleteTransfers(
    now: DateTime,
    where: (query: DatabaseQueryBuilderContract, client: QueryClientContract) => void
  ): Promise<number> {
    let total = 0
    while (true) {
      const count = await db.transaction(async (trx) => {
        const query = trx.from('transfer').select('id').whereNull('deleted_at').limit(BATCH_SIZE)
        where(query, trx)
        const rows = (await lockBatch(trx, query)) as { id: string }[]
        if (rows.length === 0) return 0

        const timestamp = sqlTime(trx, now)
        await trx
          .from('transfer')
          .whereIn(
            'id',
            rows.map((row) => row.id)
          )
          .update({ deleted_at: timestamp, updated_at: timestamp })
        return rows.length
      })
      total += count
      if (count < BATCH_SIZE) return total
    }
  }

  /**
   * Deletes the object of every not-yet-deleted file of a deleted transfer,
   * then marks the file deleted. A failed delete leaves `deleted_at` NULL so
   * the next run retries; the id cursor keeps this run from looping on it.
   */
  private static async deleteFiles(): Promise<number> {
    let total = 0
    let cursor: string | null = null
    while (true) {
      const batch = await db.transaction(async (trx) => {
        const query = trx
          .from('transfer_file')
          .select('id', 'object_key')
          .whereNull('deleted_at')
          .whereIn('transfer_id', trx.from('transfer').select('id').whereNotNull('deleted_at'))
          .if(cursor, (q) => q.where('id', '>', cursor!))
          .orderBy('id')
          .limit(BATCH_SIZE)
        const rows = (await lockBatch(trx, query)) as { id: string; object_key: string }[]

        const deleted: string[] = []
        for (const row of rows) {
          try {
            await StorageService.delete(row.object_key)
            deleted.push(row.id)
          } catch (error) {
            logger.warn({ err: error, fileId: row.id }, 'cleanup: object delete failed')
          }
        }
        if (deleted.length > 0) {
          await trx
            .from('transfer_file')
            .whereIn('id', deleted)
            .update({ deleted_at: sqlTime(trx, DateTime.now()) })
        }
        return { size: rows.length, lastId: rows.at(-1)?.id ?? null, deleted: deleted.length }
      })
      total += batch.deleted
      if (batch.size < BATCH_SIZE) return total
      cursor = batch.lastId
    }
  }

  /**
   * Deleted transfers that were never confirmed have no file rows, so any
   * bytes the browser uploaded are removed by prefix. Purging is idempotent
   * and repeats on every run; the 7-day window bounds that work.
   */
  private static async purgeUnconfirmedPrefixes(now: DateTime): Promise<number> {
    let total = 0
    let cursor: string | null = null
    while (true) {
      const rows: { id: string }[] = await db
        .from('transfer')
        .select('id')
        .whereNotNull('deleted_at')
        .where('deleted_at', '>', sqlTime(db.connection(), now.minus(PURGE_WINDOW)))
        .whereNotExists(hasFiles())
        .if(cursor, (q) => q.where('id', '>', cursor!))
        .orderBy('id')
        .limit(BATCH_SIZE)

      for (const row of rows) {
        try {
          await StorageService.deletePrefix(`transfers/${row.id}/`)
          total++
        } catch (error) {
          logger.warn({ err: error, transferId: row.id }, 'cleanup: prefix purge failed')
        }
      }
      if (rows.length < BATCH_SIZE) return total
      cursor = rows.at(-1)!.id
    }
  }
}
