import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import string from '@adonisjs/core/helpers/string'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import NotifyDownloadJob from '#jobs/notify_download_job'
import TransferFile from '#models/transfer_file'
import type User from '#models/user'
import TransferPolicy from '#policies/transfer_policy'
import StorageService from '#services/storage_service'
import env from '#start/env'
import { passwordAttempts } from '#start/limiter'

/** Same default as `StorageService.presignDownload`, so `expiresAt` matches the URL. */
const downloadTtl = () => env.get('STORAGE_DOWNLOAD_URL_TTL') || '5m'

/** Where a download request came from, recorded on every `transfer_download` row. */
export type DownloadRequestInfo = { ip: string | null; userAgent: string | null }

export type DownloadError =
  | 'not_found'
  | 'forbidden'
  | 'expired'
  | 'invalid_password'
  | 'rate_limited'
  | 'download_limit_reached'

export type DownloadResult =
  { ok: true; url: string; expiresAt: string } | { ok: false; error: DownloadError }

/** `firstForUser`: this is the user's first successful download of the transfer. */
type CheckResult =
  | { ok: true; url: string; expiresAt: string; firstForUser: boolean }
  | { ok: false; error: DownloadError }

/**
 * Authorizing a file download and handing out a presigned GET. Every attempt
 * that reaches the expiry/password/limit checks is logged in
 * `transfer_download`; failed ones with `success = false`. Each outcome is
 * also logged as `download.granted` / `download.denied` (with `reason`).
 */
export default class DownloadService {
  static async authorize(
    user: User,
    transferId: string,
    fileId: string,
    password: string | null,
    info: DownloadRequestInfo
  ): Promise<DownloadResult> {
    const result = await this.check(user, transferId, fileId, password, info)
    const event = { transferId, fileId, userId: user.id }
    if (!result.ok) {
      logger.info({ event: 'download.denied', reason: result.error, ...event }, 'download.denied')
      return result
    }
    logger.info({ event: 'download.granted', ...event }, 'download.granted')
    if (result.firstForUser) await this.sendReceipt(user, transferId, fileId)
    return { ok: true, url: result.url, expiresAt: result.expiresAt }
  }

  /**
   * Queue the creator's download receipt, unless `MAIL_ENABLED` is off. Runs
   * after the transaction committed. A failed dispatch is logged, not thrown:
   * the download itself already succeeded.
   */
  private static async sendReceipt(user: User, transferId: string, fileId: string) {
    if (!env.get('MAIL_ENABLED', false)) return
    try {
      await NotifyDownloadJob.dispatch({
        transferId,
        fileId,
        userId: user.id,
        downloadedAt: DateTime.now().toISO()!,
      })
    } catch (error) {
      logger.error({ err: error, transferId }, 'notify: receipt dispatch failed')
    }
  }

  /**
   * Run the checks in contract order (404 → 403 → expired → password →
   * limit). After 5 wrong passwords in 15 minutes the user is locked out of
   * that transfer's password check (`rate_limited`), even with the right
   * one. The limit is enforced while holding a row lock on the transfer, so
   * concurrent requests can't both take the last download.
   */
  private static async check(
    user: User,
    transferId: string,
    fileId: string,
    password: string | null,
    info: DownloadRequestInfo
  ): Promise<CheckResult> {
    const transfer = await TransferPolicy.viewable(user).where('transfer.id', transferId).first()
    if (!transfer) return { ok: false, error: 'not_found' }
    if (!(await TransferPolicy.canDownload(user, transfer)))
      return { ok: false, error: 'forbidden' }

    const file = await TransferFile.query()
      .where('id', fileId)
      .where('transferId', transferId)
      .whereNull('deleted_at')
      .first()
    if (!file) return { ok: false, error: 'not_found' }

    const row = { transferId, fileId, userId: user.id, ...info }

    if (transfer.isExpired) {
      await this.record(db, row, false)
      return { ok: false, error: 'expired' }
    }
    if (transfer.passwordHash) {
      const attempts = passwordAttempts()
      const attemptKey = `${user.id}:${transferId}`
      if ((await attempts.remaining(attemptKey)) === 0) {
        await this.record(db, row, false)
        return { ok: false, error: 'rate_limited' }
      }
      if (!(password && (await hash.verify(transfer.passwordHash, password)))) {
        await attempts.increment(attemptKey)
        await this.record(db, row, false)
        return { ok: false, error: 'invalid_password' }
      }
    }

    const expiresAt = DateTime.now().plus({ seconds: string.seconds.parse(downloadTtl()) })
    const url = await StorageService.presignDownload(file.objectKey, { filename: file.filename })

    return db.transaction(async (trx) => {
      await trx.from('transfer').where('id', transferId).forUpdate().first()

      if (transfer.maxDownloads !== null) {
        const [{ total }] = await trx
          .from('transfer_download')
          .where('transfer_id', transferId)
          .where('success', true)
          .count('* as total')
        if (Number(total) >= transfer.maxDownloads) {
          // Committed with the transaction: the failed attempt is still logged.
          await this.record(trx, row, false)
          return { ok: false, error: 'download_limit_reached' } as const
        }
      }

      // Read under the row lock, so concurrent first downloads can't both see none.
      const earlier = await trx
        .from('transfer_download')
        .where('transfer_id', transferId)
        .where('user_id', user.id)
        .where('success', true)
        .first()

      await this.record(trx, row, true)
      return { ok: true, url, expiresAt: expiresAt.toISO()!, firstForUser: !earlier } as const
    })
  }

  /** Append one attempt to the download log. */
  private static async record(
    client: typeof db | TransactionClientContract,
    row: { transferId: string; fileId: string; userId: string } & DownloadRequestInfo,
    success: boolean
  ) {
    await client.table('transfer_download').insert({
      id: randomUUID(),
      transfer_id: row.transferId,
      transfer_file_id: row.fileId,
      user_id: row.userId,
      ip_address: row.ip,
      user_agent: row.userAgent,
      success,
    })
  }
}
