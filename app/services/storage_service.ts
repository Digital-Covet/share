import drive from '@adonisjs/drive/services/main'
import env from '#start/env'

const uploadTtl = () => env.get('STORAGE_UPLOAD_URL_TTL') || '1h'
const downloadTtl = () => env.get('STORAGE_DOWNLOAD_URL_TTL') || '5m'

/** RFC 5987 `ext-value` characters: encodeURIComponent leaves `'()*` alone. */
const encodeRfc5987 = (value: string) =>
  encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )

/**
 * `Content-Disposition: attachment` with an ASCII-only `filename` fallback
 * (quotes, backslashes, control and non-ASCII characters replaced) plus the
 * exact name as UTF-8 in `filename*` for clients that support it.
 */
export function attachmentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, '_').trim() || 'download'
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987(filename)}`
}

/**
 * Object storage for transfer files via Adonis Drive. File bytes never pass
 * through the app: clients get short-lived presigned URLs instead.
 */
export default class StorageService {
  /**
   * Presigned PUT for one object. The client must send `headers` with the
   * request; the declared size is signed too where the driver supports it.
   */
  static async presignUpload(
    key: string,
    opts: { contentType: string; sizeBytes: number }
  ): Promise<{ url: string; method: 'PUT'; headers: Record<string, string> }> {
    const url = await drive.use().getSignedUploadUrl(key, {
      expiresIn: uploadTtl(),
      contentType: opts.contentType,
      ContentLength: opts.sizeBytes,
    })
    return { url, method: 'PUT', headers: { 'Content-Type': opts.contentType } }
  }

  /** Presigned GET that makes browsers save the object as `filename`. */
  static async presignDownload(key: string, opts: { filename: string }): Promise<string> {
    return drive.use().getSignedUrl(key, {
      expiresIn: downloadTtl(),
      contentDisposition: attachmentDisposition(opts.filename),
    })
  }

  /** Remove one object; missing objects are fine. */
  static async delete(key: string): Promise<void> {
    await drive.use().delete(key)
  }

  /** Remove every object under `prefix` (e.g. `transfers/<id>/`); idempotent. */
  static async deletePrefix(prefix: string): Promise<void> {
    await drive.use().deleteAll(prefix)
  }

  /** Size of a stored object, or `null` when it doesn't exist. */
  static async stat(key: string): Promise<{ sizeBytes: number } | null> {
    const disk = drive.use()
    try {
      const meta = await disk.getMetaData(key)
      return { sizeBytes: meta.contentLength }
    } catch (error) {
      if (!(await disk.exists(key))) return null
      throw error
    }
  }
}
