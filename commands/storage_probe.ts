import { randomUUID } from 'node:crypto'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import StorageService from '#services/storage_service'

/**
 * Round trip against the configured disk the way browsers will use it:
 * presigned PUT, presigned GET, then delete. Prints OK or FAIL.
 */
export default class StorageProbe extends BaseCommand {
  static commandName = 'storage:probe'
  static description = 'Check object storage with a presigned upload/download round trip'
  static options: CommandOptions = { startApp: true }

  async run() {
    const key = `probe/${randomUUID()}`
    const body = `covetdrop probe ${new Date().toISOString()}`
    const contentType = 'text/plain'

    try {
      const upload = await StorageService.presignUpload(key, {
        contentType,
        sizeBytes: Buffer.byteLength(body),
      })
      const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body })
      if (!put.ok) throw new Error(`PUT failed (${put.status}): ${await put.text()}`)

      const stat = await StorageService.stat(key)
      if (stat?.sizeBytes !== Buffer.byteLength(body)) {
        throw new Error(`stat returned ${JSON.stringify(stat)}`)
      }

      const url = await StorageService.presignDownload(key, { filename: 'probé file.txt' })
      const get = await fetch(url)
      const text = await get.text()
      if (!get.ok) throw new Error(`GET failed (${get.status}): ${text}`)
      if (text !== body) throw new Error('GET returned different bytes')
      this.logger.info(`Content-Disposition: ${get.headers.get('content-disposition')}`)

      await StorageService.delete(key)
      if ((await StorageService.stat(key)) !== null) throw new Error('object still exists')

      this.logger.success('OK')
    } catch (error) {
      await StorageService.delete(key).catch(() => {})
      // Drive wraps driver errors; the cause holds the S3/network detail.
      const cause = error instanceof Error && error.cause instanceof Error ? error.cause : null
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`FAIL: ${message}${cause ? ` (${cause.message})` : ''}`)
      this.exitCode = 1
    }
  }
}
