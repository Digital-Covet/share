import vine from '@vinejs/vine'

/** `POST /transfers/:id/download/:fileId`. Only checked against `password_hash`, never stored. */
export const downloadValidator = vine.create({
  password: vine.string().maxLength(128).nullable().optional(),
})
