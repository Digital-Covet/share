import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import hash from '@adonisjs/core/services/hash'
import mail from '@adonisjs/mail/services/main'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import env from '#start/env'
import type User from '#models/user'
import TransferDownloadedNotification from '#mails/transfer_downloaded_notification'
import { UserFactory } from '#database/factories/user_factory'
import { TransferFactory } from '#database/factories/transfer_factory'
import { signIn } from '#tests/helpers/sign_in'

/** A confirmed, password-protected transfer from `creator` to `recipients`. */
async function makeTransfer(creator: User, recipients: User[]) {
  const id = randomUUID()
  const fileId = randomUUID()
  await TransferFactory.merge({
    id,
    createdBy: creator.id,
    title: 'Q3 report',
    expiresAt: DateTime.now().plus({ days: 7 }),
    passwordHash: await hash.make('correct horse'),
  }).create()
  for (const recipient of recipients) {
    await db
      .table('transfer_recipient')
      .insert({ id: randomUUID(), transfer_id: id, user_id: recipient.id })
  }
  await db.table('transfer_file').insert({
    id: fileId,
    transfer_id: id,
    filename: 'report.pdf',
    size_bytes: 11,
    object_key: `transfers/${id}/${fileId}`,
  })
  return { id, fileId }
}

const download = (
  client: ApiClient,
  user: User,
  transferId: string,
  fileId: string,
  password = 'correct horse'
) =>
  signIn(
    client
      .post(`/transfers/${transferId}/download/${fileId}`)
      .accept('json')
      .json({ password })
      .withCsrfToken(),
    user
  )

const downloadOk = async (client: ApiClient, user: User, transferId: string, fileId: string) => {
  const response = await download(client, user, transferId, fileId)
  response.assertStatus(200)
}

test.group('Transfers / download receipt', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })
  let mails: ReturnType<typeof mail.fake>['mails']
  group.each.setup(() => {
    env.set('MAIL_ENABLED', true)
    mails = mail.fake().mails
    return () => {
      mail.restore()
      env.set('MAIL_ENABLED', false)
    }
  })

  test('the creator gets one receipt per recipient, on the first download', async ({
    client,
    assert,
  }) => {
    const creator = await UserFactory.create()
    const ada = await UserFactory.merge({ name: 'Ada Lovelace' }).create()
    const bob = await UserFactory.create()
    const { id, fileId } = await makeTransfer(creator, [ada, bob])

    await downloadOk(client, ada, id, fileId)
    await downloadOk(client, ada, id, fileId)
    await downloadOk(client, bob, id, fileId)

    mails.assertSentCount(TransferDownloadedNotification, 2)
    const [receipt] = mails.sent((m) => m.message.toObject().message.subject!.includes('Ada'))
    receipt.message.assertTo(creator.email, creator.name ?? undefined)
    receipt.message.assertSubject('Ada Lovelace downloaded "Q3 report"')
    receipt.message.assertHtmlIncludes('report.pdf')
    receipt.message.assertHtmlIncludes(`/transfers/${id}`)

    for (const sent of mails.sent()) {
      const { html, text } = sent.message.toObject().message as { html?: string; text?: string }
      for (const content of [html ?? '', text ?? '']) {
        assert.notInclude(content, 'correct horse')
        assert.notInclude(content, `transfers/${id}/${fileId}`)
        assert.notInclude(content, '/download')
      }
    }
  })

  test("the creator's own download sends nothing", async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, [recipient])

    await downloadOk(client, creator, id, fileId)

    mails.assertNoneSent()
  })

  test('a failed download sends nothing', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, [recipient])

    const response = await download(client, recipient, id, fileId, 'wrong')

    response.assertStatus(403)
    mails.assertNoneSent()
  })

  test('MAIL_ENABLED=false sends nothing', async ({ client }) => {
    env.set('MAIL_ENABLED', false)
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, [recipient])

    await downloadOk(client, recipient, id, fileId)

    mails.assertNoneSent()
  })
})
