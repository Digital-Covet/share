import type Transfer from '#models/transfer'
import { BaseTransformer } from '@adonisjs/core/transformers'
import UserTransformer from '#transformers/user_transformer'

/**
 * A transfer for its detail page (`toObject`) or a list row (`toListItem`).
 * The detail shape expects `creator` and `files` preloaded and the
 * successful-download count loaded as `downloads_count`. `recipients` is
 * sent only when `recipientUsers` is preloaded, which the controller does
 * for the creator alone.
 */
export default class TransferTransformer extends BaseTransformer<Transfer> {
  toObject() {
    const files = this.resource.files ?? []
    return {
      ...this.pick(this.resource, [
        'id',
        'title',
        'message',
        'expiresAt',
        'createdAt',
        'maxDownloads',
        'hasPassword',
        'isExpired',
      ]),
      // `complete` writes every file row at once, so any row means confirmed.
      isConfirmed: files.length > 0,
      creator: UserTransformer.transform(this.resource.creator),
      files: files.map((file) => ({
        ...this.pick(file, ['id', 'filename', 'mimeType']),
        // `bigint` columns come back from pg as strings.
        sizeBytes: Number(file.sizeBytes),
      })),
      recipients: UserTransformer.transform(this.whenLoaded(this.resource.recipientUsers)),
      successfulDownloads: Number(this.resource.$extras.downloads_count ?? 0),
    }
  }

  /**
   * A row of the transfer lists. Expects `creator` preloaded and the
   * `file_count`, `total_bytes` and `downloads_count` extras that
   * `TransferListService` selects.
   */
  toListItem() {
    const fileCount = Number(this.resource.$extras.file_count ?? 0)
    return {
      ...this.pick(this.resource, ['id', 'title', 'expiresAt', 'createdAt', 'isExpired']),
      isConfirmed: fileCount > 0,
      creator: UserTransformer.transform(this.resource.creator),
      fileCount,
      // SUM over a `bigint` column comes back as a string (or NULL with no rows).
      totalBytes: Number(this.resource.$extras.total_bytes ?? 0),
      successfulDownloads: Number(this.resource.$extras.downloads_count ?? 0),
    }
  }
}
