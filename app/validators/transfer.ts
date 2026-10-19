import vine from '@vinejs/vine'
import env from '#start/env'

/** Largest file the DB allows (`transfer_file_size_bytes_check`). */
const MAX_FILE_BYTES = 5 * 1024 ** 3
const MAX_EXPIRY_DAYS = 30

/** min(5 GiB, provider's single-PUT cap) — see Open question 6. */
export const maxFileBytes = () =>
  Math.min(MAX_FILE_BYTES, env.get('STORAGE_MAX_SINGLE_PUT_BYTES') ?? MAX_FILE_BYTES)

/** Expiry must be in the future and at most 30 days away. */
const expiryWindow = vine.createRule((value, _, field) => {
  if (!field.isValid) return
  // A Date, or a Luxon DateTime once the global transform ran; both valueOf() to ms.
  const at = Number((value as Date).valueOf())
  const now = Date.now()
  if (at <= now) {
    field.report('The {{ field }} must be in the future', 'expiresAt.future', field)
  } else if (at > now + MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
    field.report(
      `The {{ field }} must be within ${MAX_EXPIRY_DAYS} days`,
      'expiresAt.maxWindow',
      field
    )
  }
})

/**
 * `POST /transfers`. Validated with `{ userId }` metadata so the creator
 * can't add themselves as a recipient. Duplicate recipient ids are allowed
 * here and dropped by `TransferService.create`.
 */
export const createTransferValidator = vine.withMetaData<{ userId: string }>().create({
  title: vine.string().trim().minLength(1).maxLength(200),
  message: vine.string().trim().maxLength(5000).nullable().optional(),
  expiresAt: vine.date({ formats: ['iso8601'] }).use(expiryWindow()),
  maxDownloads: vine.number().withoutDecimals().min(1).nullable().optional(),
  password: vine.string().minLength(8).maxLength(128).nullable().optional(),
  recipientIds: vine
    .array(
      vine
        .string()
        .uuid()
        .exists(async (db, value, field) => {
          if (value === field.meta.userId) return false
          return !!(await db.from('user').select('id').where('id', value).first())
        })
    )
    .minLength(1)
    .maxLength(50),
  files: vine
    .array(
      vine.object({
        filename: vine.string().trim().minLength(1).maxLength(255),
        sizeBytes: vine.number().withoutDecimals().min(1).max(maxFileBytes()),
        mimeType: vine.string().trim().maxLength(255).nullable().optional(),
      })
    )
    .minLength(1)
    .maxLength(20),
})

/** `POST /transfers/:id/complete`. */
export const completeTransferValidator = vine.create({
  uploadToken: vine.string().minLength(1),
})
