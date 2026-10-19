import { randomUUID } from 'node:crypto'
import type { Infer } from '@vinejs/vine/types'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import NotifyRecipientsJob from '#jobs/notify_recipients_job'
import Transfer from '#models/transfer'
import TransferRecipient from '#models/transfer_recipient'
import type User from '#models/user'
import StorageService from '#services/storage_service'
import { openManifest, sealManifest, type UploadManifest } from '#services/upload_token'
import type { createTransferValidator } from '#validators/transfer'

export type CreateTransferPayload = Infer<typeof createTransferValidator>

export type CreatedTransfer = {
  transferId: string
  uploadToken: string
  uploads: Array<{ fileId: string; url: string; method: 'PUT'; headers: Record<string, string> }>
}

export type CompleteResult =
  | { ok: true; transferId: string; firstConfirmation: boolean }
  | { ok: false; error: 'invalid_upload_token' }
  | { ok: false; error: 'files_missing' | 'size_mismatch'; fileIds: string[] }

const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

/** `transfers/<transfer_id>/<transfer_file_id>` — never contains user input. */
export const objectKey = (transferId: string, fileId: string) => `transfers/${transferId}/${fileId}`

/**
 * Creating and confirming transfers. A transfer has no status column: it's
 * confirmed once `complete` has written its `transfer_file` rows.
 */
export default class TransferService {
  /**
   * Insert the transfer and its recipients, then hand back presigned PUTs and
   * a sealed manifest. File rows are written later by `complete`.
   */
  static async create(user: User, payload: CreateTransferPayload): Promise<CreatedTransfer> {
    const transferId = randomUUID()
    const passwordHash = payload.password ? await hash.make(payload.password) : null

    await db.transaction(async (trx) => {
      await Transfer.create(
        {
          id: transferId,
          title: payload.title,
          message: payload.message || null,
          expiresAt: payload.expiresAt,
          maxDownloads: payload.maxDownloads ?? null,
          passwordHash,
          createdBy: user.id,
        },
        { client: trx }
      )
      await TransferRecipient.createMany(
        [...new Set(payload.recipientIds)].map((userId) => ({
          id: randomUUID(),
          transferId,
          userId,
        })),
        { client: trx }
      )
    })

    const manifest: UploadManifest = {
      transferId,
      files: payload.files.map((file) => {
        const id = randomUUID()
        return {
          id,
          filename: file.filename,
          sizeBytes: file.sizeBytes,
          mimeType: file.mimeType || null,
          objectKey: objectKey(transferId, id),
        }
      }),
    }

    const uploads = await Promise.all(
      manifest.files.map(async (file) => {
        const upload = await StorageService.presignUpload(file.objectKey, {
          contentType: file.mimeType ?? DEFAULT_CONTENT_TYPE,
          sizeBytes: file.sizeBytes,
        })
        return { fileId: file.id, ...upload }
      })
    )

    logger.info(
      {
        event: 'transfer.created',
        transferId,
        userId: user.id,
        recipientCount: new Set(payload.recipientIds).size,
        fileCount: manifest.files.length,
        declaredBytes: manifest.files.reduce((sum, f) => sum + f.sizeBytes, 0),
      },
      'transfer.created'
    )
    return { transferId, uploadToken: sealManifest(manifest), uploads }
  }

  /**
   * Verify every declared object is in storage with its declared size, then
   * insert the file rows. Idempotent: rows use the manifest's ids, so only
   * the first successful call inserts (`firstConfirmation`). Throws a 404
   * unless `user` created the non-deleted transfer.
   */
  static async complete(
    user: User,
    transferId: string,
    uploadToken: string
  ): Promise<CompleteResult> {
    await Transfer.query()
      .withScopes((s) => s.active())
      .where('id', transferId)
      .where('createdBy', user.id)
      .firstOrFail()

    const manifest = openManifest(uploadToken, transferId)
    if (!manifest) return { ok: false, error: 'invalid_upload_token' }

    const stats = await Promise.all(manifest.files.map((f) => StorageService.stat(f.objectKey)))
    const missing = manifest.files.filter((_, i) => stats[i] === null).map((f) => f.id)
    if (missing.length) return { ok: false, error: 'files_missing', fileIds: missing }
    const mismatched = manifest.files
      .filter((f, i) => stats[i]!.sizeBytes !== f.sizeBytes)
      .map((f) => f.id)
    if (mismatched.length) return { ok: false, error: 'size_mismatch', fileIds: mismatched }

    // Through knex: Lucid drops RETURNING on SQLite, which the test suite uses.
    const inserted: Array<{ id: string }> = await db
      .knexQuery()
      .table('transfer_file')
      .insert(
        manifest.files.map((f) => ({
          id: f.id,
          transfer_id: transferId,
          filename: f.filename,
          size_bytes: f.sizeBytes,
          mime_type: f.mimeType,
          object_key: f.objectKey,
        }))
      )
      .onConflict('id')
      .ignore()
      .returning('id')

    const firstConfirmation = inserted.length > 0
    if (firstConfirmation) {
      // `storedBytes` is verified in storage: the source for storage-usage metrics.
      logger.info(
        {
          event: 'transfer.upload_confirmed',
          transferId,
          userId: user.id,
          fileCount: manifest.files.length,
          storedBytes: manifest.files.reduce((sum, f) => sum + f.sizeBytes, 0),
        },
        'transfer.upload_confirmed'
      )
      await this.notifyRecipients(transferId)
    }
    return { ok: true, transferId, firstConfirmation }
  }

  /**
   * Queue the recipient emails, unless `MAIL_ENABLED` is off. Runs after the
   * (autocommitted) file insert, so the job sees a confirmed transfer. A
   * failed dispatch is logged, not thrown: the upload is already confirmed
   * and a retried `complete` wouldn't dispatch again.
   */
  private static async notifyRecipients(transferId: string) {
    if (!env.get('MAIL_ENABLED', false)) return
    try {
      await NotifyRecipientsJob.dispatch({ transferId })
    } catch (error) {
      logger.error({ err: error, transferId }, 'notify: dispatch failed')
    }
  }
}
