import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import env from '#start/env'
import type User from '#models/user'
import ExpiryReminderService from '#services/expiry_reminder_service'
import TransferExpiringNotification from '#mails/transfer_expiring_notification'
import { UserFactory } from '#database/factories/user_factory'
import { TransferFactory } from '#database/factories/transfer_factory'

const sqlTime = (value: DateTime) => value.toFormat(db.connection().dialect.dateTimeFormat)

type Options = {
  confirmed?: boolean
  expiresAt?: DateTime
  createdAt?: DateTime
  deletedAt?: DateTime
}

/**
 * A transfer to `recipients` expiring in 12h and created 3 days ago unless
 * overridden. Timestamps are written with SQL so Lucid's auto timestamps
 * don't override them.
 */
async function makeTransfer(
  recipients: User[],
  {
    confirmed = true,
    expiresAt = DateTime.now().plus({ hours: 12 }),
    createdAt = DateTime.now().minus({ days: 3 }),
    deletedAt,
  }: Options = {}
) {
  const creator = await UserFactory.create()
  const id = randomUUID()
  const fileId = randomUUID()
  await TransferFactory.merge({ id, createdBy: creator.id, title: 'Q3 report' }).create()
  await db
    .from('transfer')
    .where('id', id)
    .update({
      expires_at: sqlTime(expiresAt),
      created_at: sqlTime(createdAt),
      deleted_at: deletedAt ? sqlTime(deletedAt) : null,
    })
  for (const recipient of recipients) {
    await db
      .table('transfer_recipient')
      .insert({ id: randomUUID(), transfer_id: id, user_id: recipient.id })
  }
  if (confirmed) {
    await db.table('transfer_file').insert({
      id: fileId,
      transfer_id: id,
      filename: 'report.pdf',
      size_bytes: 11,
      object_key: `transfers/${id}/${fileId}`,
    })
  }
  return { id, fileId }
}

const recordDownload = (transferId: string, fileId: string, user: User, success = true) =>
  db.table('transfer_download').insert({
    id: randomUUID(),
    transfer_id: transferId,
    transfer_file_id: fileId,
    user_id: user.id,
    success,
  })

test.group('ExpiryReminderService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  let mails: ReturnType<typeof mail.fake>['mails']
  group.each.setup(() => {
    env.set('MAIL_ENABLED', true)
    mails = mail.fake().mails
    return () => {
      mail.restore()
      env.set('MAIL_ENABLED', false)
    }
  })

  test('reminds only recipients who have not downloaded, once', async ({ assert }) => {
    const [downloaded, failedOnly, untouched] = await UserFactory.createMany(3)
    const { id, fileId } = await makeTransfer([downloaded, failedOnly, untouched])
    await recordDownload(id, fileId, downloaded)
    await recordDownload(id, fileId, failedOnly, false)

    const first = await ExpiryReminderService.run()
    const second = await ExpiryReminderService.run()

    assert.deepEqual(first, { transfers: 1, emails: 2 })
    assert.deepEqual(second, { transfers: 0, emails: 0 })
    mails.assertSentCount(TransferExpiringNotification, 2)
    const recipients = mails.sent().map((m) => JSON.stringify(m.message.toObject().message.to))
    assert.isTrue(recipients.some((to) => to.includes(failedOnly.email)))
    assert.isTrue(recipients.some((to) => to.includes(untouched.email)))
    assert.isFalse(recipients.some((to) => to.includes(downloaded.email)))

    const [message] = mails.sent()
    message.message.assertHtmlIncludes(`/transfers/${id}`)
    const row = await db.from('transfer').where('id', id).firstOrFail()
    assert.isNotNull(row.expiry_reminder_sent_at)
  })

  test('skips transfers outside the window, young, unconfirmed, expired or deleted', async ({
    assert,
  }) => {
    const [recipient] = await UserFactory.createMany(1)
    await makeTransfer([recipient], { expiresAt: DateTime.now().plus({ days: 3 }) })
    await makeTransfer([recipient], { createdAt: DateTime.now().minus({ hours: 6 }) })
    await makeTransfer([recipient], { confirmed: false })
    await makeTransfer([recipient], { expiresAt: DateTime.now().minus({ hours: 1 }) })
    await makeTransfer([recipient], { deletedAt: DateTime.now().minus({ hours: 1 }) })

    const result = await ExpiryReminderService.run()

    assert.deepEqual(result, { transfers: 0, emails: 0 })
    mails.assertNoneSent()
  })

  test('MAIL_ENABLED=false sends nothing and claims nothing', async ({ assert }) => {
    env.set('MAIL_ENABLED', false)
    const [recipient] = await UserFactory.createMany(1)
    const { id } = await makeTransfer([recipient])

    await ExpiryReminderService.run()

    mails.assertNoneSent()
    const row = await db.from('transfer').where('id', id).firstOrFail()
    assert.isNull(row.expiry_reminder_sent_at)
  })
})
