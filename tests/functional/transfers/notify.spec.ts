import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import env from '#start/env'
import type User from '#models/user'
import { objectKey } from '#services/transfer_service'
import TransferReceivedNotification from '#mails/transfer_received_notification'
import { UserFactory } from '#database/factories/user_factory'
import { signIn } from '#tests/helpers/sign_in'

const FILES = [
  { filename: 'report.pdf', sizeBytes: 11, mimeType: 'application/pdf' },
  { filename: 'data.bin', sizeBytes: 4, mimeType: null },
]

/** Create a transfer as `creator` for `recipients` and return the 201 body. */
const start = async (client: ApiClient, creator: User, recipients: User[]) => {
  const response = await signIn(
    client
      .post('/transfers')
      .accept('json')
      .json({
        title: 'Q3 report',
        message: 'See attached',
        expiresAt: DateTime.now().plus({ days: 7 }).toISO(),
        maxDownloads: null,
        password: 'correct horse',
        recipientIds: recipients.map((r) => r.id),
        files: FILES,
      })
      .withCsrfToken(),
    creator
  )
  response.assertStatus(201)
  const body = response.body() as {
    transferId: string
    uploadToken: string
    uploads: Array<{ fileId: string }>
  }
  return { ...body, fileIds: body.uploads.map((u) => u.fileId) }
}

const complete = (client: ApiClient, user: User, transferId: string, uploadToken: string) =>
  signIn(
    client
      .post(`/transfers/${transferId}/complete`)
      .accept('json')
      .json({ uploadToken })
      .withCsrfToken(),
    user
  )

/** Put objects where the presigned PUTs would have; `count` limits how many. */
const fakeUploads = async (transferId: string, fileIds: string[], count = fileIds.length) => {
  for (const [i, fileId] of fileIds.slice(0, count).entries()) {
    await drive.use().put(objectKey(transferId, fileId), 'x'.repeat(FILES[i].sizeBytes))
  }
}

test.group('Transfers / notify recipients', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    const fake = drive.fake()
    return () => {
      fake.clear()
      drive.restore()
    }
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

  test('first confirmation emails each recipient a link to the transfer page', async ({
    client,
    assert,
  }) => {
    const creator = await UserFactory.merge({ name: 'Ada Lovelace' }).create()
    const recipients = await UserFactory.createMany(2)
    const { transferId, uploadToken, fileIds } = await start(client, creator, recipients)
    await fakeUploads(transferId, fileIds)

    const response = await complete(client, creator, transferId, uploadToken)

    response.assertStatus(200)
    mails.assertSentCount(TransferReceivedNotification, 2)
    const link = `${env.get('APP_URL').replace(/\/$/, '')}/transfers/${transferId}`
    for (const recipient of recipients) {
      const sent = mails.sent((m) =>
        JSON.stringify(m.message.toObject().message.to).includes(recipient.email)
      )
      assert.lengthOf(sent, 1)
      const { message } = sent[0]
      message.assertTo(recipient.email, recipient.name ?? undefined)
      message.assertSubject('Ada Lovelace sent you "Q3 report"')
      message.assertHtmlIncludes(link)
      message.assertHtmlIncludes('Ada Lovelace')
      message.assertTextIncludes(link)
    }
    for (const sent of mails.sent()) {
      const { html, text } = sent.message.toObject().message as { html?: string; text?: string }
      for (const content of [html ?? '', text ?? '']) {
        assert.notInclude(content, 'correct horse')
        assert.notInclude(content, objectKey(transferId, ''))
        assert.notInclude(content, '/download')
      }
    }
  })

  test('a 409 complete sends nothing', async ({ client }) => {
    const creator = await UserFactory.create()
    const recipients = await UserFactory.createMany(2)
    const { transferId, uploadToken, fileIds } = await start(client, creator, recipients)
    await fakeUploads(transferId, fileIds, 1)

    const response = await complete(client, creator, transferId, uploadToken)

    response.assertStatus(409)
    mails.assertNoneSent()
  })

  test('completing twice sends each recipient one email', async ({ client }) => {
    const creator = await UserFactory.create()
    const recipients = await UserFactory.createMany(2)
    const { transferId, uploadToken, fileIds } = await start(client, creator, recipients)
    await fakeUploads(transferId, fileIds)

    const first = await complete(client, creator, transferId, uploadToken)
    const second = await complete(client, creator, transferId, uploadToken)

    first.assertStatus(200)
    second.assertStatus(200)
    second.assertBodyContains({ firstConfirmation: false })
    mails.assertSentCount(TransferReceivedNotification, 2)
  })

  test('MAIL_ENABLED=false sends nothing', async ({ client }) => {
    env.set('MAIL_ENABLED', false)
    const creator = await UserFactory.create()
    const recipients = await UserFactory.createMany(2)
    const { transferId, uploadToken, fileIds } = await start(client, creator, recipients)
    await fakeUploads(transferId, fileIds)

    const response = await complete(client, creator, transferId, uploadToken)

    response.assertStatus(200)
    response.assertBodyContains({ firstConfirmation: true })
    mails.assertNoneSent()
  })
})
