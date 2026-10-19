import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import type User from '#models/user'
import { UserFactory } from '#database/factories/user_factory'
import { TransferFactory } from '#database/factories/transfer_factory'
import { signIn } from '#tests/helpers/sign_in'

/** A confirmed transfer from `creator` to `recipient` with one file. */
async function makeTransfer(creator: User, recipient: User, passwordHash: string | null = null) {
  const id = randomUUID()
  const fileId = randomUUID()
  await TransferFactory.merge({
    id,
    createdBy: creator.id,
    expiresAt: DateTime.now().plus({ days: 7 }),
    passwordHash,
  }).create()
  await db
    .table('transfer_recipient')
    .insert({ id: randomUUID(), transfer_id: id, user_id: recipient.id })
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
  password: string | null = null
) =>
  signIn(
    client
      .post(`/transfers/${transferId}/download/${fileId}`)
      .accept('json')
      .json({ password })
      .withCsrfToken(),
    user
  )

/** Records every `logger.info` call while the test runs. */
function spyOnLogger() {
  const calls: Array<Record<string, unknown>> = []
  const original = logger.info
  logger.info = function (this: typeof logger, ...args: any[]) {
    if (args[0] && typeof args[0] === 'object') calls.push(args[0])
    return (original as any).apply(this, args)
  } as typeof logger.info
  return {
    calls,
    restore: () => {
      logger.info = original
    },
  }
}

test.group('Transfers / rate limits', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('6th wrong password within the window → 429, even with the right one', async ({
    client,
    assert,
  }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, recipient, await hash.make('correct horse'))

    for (let i = 0; i < 5; i++) {
      const response = await download(client, recipient, id, fileId, 'wrong password')
      response.assertStatus(403)
      response.assertBody({ error: 'invalid_password' })
    }
    const sixth = await download(client, recipient, id, fileId, 'wrong password')
    const right = await download(client, recipient, id, fileId, 'correct horse')

    sixth.assertStatus(429)
    sixth.assertBody({ error: 'rate_limited' })
    right.assertStatus(429)
    const rows = await db.from('transfer_download').where('transfer_id', id)
    assert.lengthOf(rows, 7)
    assert.isTrue(rows.every((r) => !r.success))
  })

  test('wrong passwords are counted per user and transfer', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const passwordHash = await hash.make('correct horse')
    const locked = await makeTransfer(creator, recipient, passwordHash)
    const other = await makeTransfer(creator, recipient, passwordHash)

    for (let i = 0; i < 5; i++) {
      await download(client, recipient, locked.id, locked.fileId, 'wrong password')
    }

    const otherTransfer = await download(client, recipient, other.id, other.fileId, 'correct horse')
    const creatorOnLocked = await download(
      client,
      creator,
      locked.id,
      locked.fileId,
      'correct horse'
    )
    otherTransfer.assertStatus(200)
    creatorOnLocked.assertStatus(200)
  })

  test('31st download request within a minute → 429', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id } = await makeTransfer(creator, recipient)

    // Unknown file ids answer 404 quickly but still count against the limit.
    for (let i = 0; i < 30; i++) {
      const response = await download(client, recipient, id, randomUUID())
      response.assertStatus(404)
    }
    const response = await download(client, recipient, id, randomUUID())

    response.assertStatus(429)
    response.assertBody({ error: 'rate_limited' })
    response.assertHeader('retry-after')
  })

  test('11th transfer creation within a minute → 429', async ({ client }) => {
    const user = await UserFactory.create()
    const create = () =>
      signIn(client.post('/transfers').accept('json').json({}).withCsrfToken(), user)

    // Invalid bodies (422) still count: the throttle runs before validation.
    for (let i = 0; i < 10; i++) {
      const response = await create()
      response.assertStatus(422)
    }
    const response = await create()

    response.assertStatus(429)
    response.assertBody({ error: 'rate_limited' })
  })

  test('download.granted and download.denied are logged with ids, never secrets', async ({
    client,
    assert,
    cleanup,
  }) => {
    const [creator, recipient, stranger] = await UserFactory.createMany(3)
    const { id, fileId } = await makeTransfer(creator, recipient, await hash.make('correct horse'))
    const spy = spyOnLogger()
    cleanup(spy.restore)

    const granted = await download(client, recipient, id, fileId, 'correct horse')
    await download(client, recipient, id, fileId, 'wrong password')
    await download(client, stranger, id, fileId, 'correct horse')

    const events = spy.calls.filter((c) => String(c.event).startsWith('download.'))
    assert.deepEqual(events, [
      { event: 'download.granted', transferId: id, fileId, userId: recipient.id },
      {
        event: 'download.denied',
        reason: 'invalid_password',
        transferId: id,
        fileId,
        userId: recipient.id,
      },
      {
        event: 'download.denied',
        reason: 'not_found',
        transferId: id,
        fileId,
        userId: stranger.id,
      },
    ])
    const logged = JSON.stringify(spy.calls)
    assert.notInclude(logged, 'correct horse')
    assert.notInclude(logged, 'wrong password')
    assert.notInclude(logged, granted.body().url)
  })
})
