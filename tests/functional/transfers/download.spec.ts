import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import Transfer from '#models/transfer'
import type User from '#models/user'
import { UserFactory } from '#database/factories/user_factory'
import { TransferFactory } from '#database/factories/transfer_factory'
import { signIn } from '#tests/helpers/sign_in'

/**
 * A transfer from `creator` to `recipient` with one file row (`report.pdf`)
 * when `confirmed`. Returns ids rather than models: Lucid replaces a
 * self-assigned id with the rowid on SQLite.
 */
async function makeTransfer(
  creator: User,
  recipient: User,
  {
    confirmed = true,
    expiresAt = DateTime.now().plus({ days: 7 }),
    maxDownloads = null as number | null,
    passwordHash = null as string | null,
  } = {}
) {
  const id = randomUUID()
  const fileId = randomUUID()
  await TransferFactory.merge({
    id,
    createdBy: creator.id,
    expiresAt,
    maxDownloads,
    passwordHash,
  }).create()
  await db
    .table('transfer_recipient')
    .insert({ id: randomUUID(), transfer_id: id, user_id: recipient.id })
  if (confirmed) {
    await db.table('transfer_file').insert({
      id: fileId,
      transfer_id: id,
      filename: 'Q3 report ü.pdf',
      size_bytes: 11,
      object_key: `transfers/${id}/${fileId}`,
    })
  }
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
      .header('user-agent', 'japa-test/1.0')
      .json({ password })
      .withCsrfToken(),
    user
  )

/** Unordered: `downloaded_at` has one-second resolution on SQLite. */
const downloadRows = (transferId: string) =>
  db.from('transfer_download').where('transfer_id', transferId)

test.group('Transfers / download', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('recipient gets a presigned URL and the download is recorded', async ({
    client,
    assert,
  }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, recipient)

    const response = await download(client, recipient, id, fileId)

    response.assertStatus(200)
    const { url, expiresAt } = response.body()
    assert.include(url, `transfers/${id}/${fileId}`)
    assert.include(decodeURIComponent(url), `filename*=UTF-8''Q3%20report%20%C3%BC.pdf`)
    assert.isTrue(DateTime.fromISO(expiresAt) > DateTime.now())

    const rows = await downloadRows(id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].user_id, recipient.id)
    assert.equal(rows[0].transfer_file_id, fileId)
    assert.isTrue(Boolean(rows[0].success))
    assert.isNotNull(rows[0].ip_address)
    assert.equal(rows[0].user_agent, 'japa-test/1.0')
  })

  test('creator can download without being a recipient', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, recipient)

    const response = await download(client, creator, id, fileId)

    response.assertStatus(200)
    assert.lengthOf(await downloadRows(id), 1)
  })

  test('404 for a stranger, a deleted transfer and a file of another transfer', async ({
    client,
    assert,
  }) => {
    const [creator, recipient, stranger] = await UserFactory.createMany(3)
    const { id, fileId } = await makeTransfer(creator, recipient)
    const other = await makeTransfer(creator, recipient)
    const deleted = await makeTransfer(creator, recipient)
    const deletedTransfer = await Transfer.findOrFail(deleted.id)
    await deletedTransfer.softDelete()

    const cases = [
      await download(client, stranger, id, fileId),
      await download(client, recipient, deleted.id, deleted.fileId),
      await download(client, recipient, id, other.fileId),
      await download(client, recipient, id, randomUUID()),
    ]

    for (const response of cases) {
      response.assertStatus(404)
      response.assertBody({ error: 'not_found' })
    }
    const [{ total }] = await db.from('transfer_download').count('* as total')
    assert.equal(Number(total), 0)
  })

  test('403 forbidden for the creator of an unconfirmed transfer', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, recipient, { confirmed: false })

    const response = await download(client, creator, id, fileId)

    response.assertStatus(403)
    response.assertBody({ error: 'forbidden' })
    assert.lengthOf(await downloadRows(id), 0)
  })

  test('410 expired, logged as a failed attempt', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, recipient, {
      expiresAt: DateTime.now().minus({ minutes: 1 }),
    })

    const response = await download(client, recipient, id, fileId)

    response.assertStatus(410)
    response.assertBody({ error: 'expired' })
    const rows = await downloadRows(id)
    assert.lengthOf(rows, 1)
    assert.isFalse(Boolean(rows[0].success))
  })

  test('password: missing or wrong → 403, right → 200', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, recipient, {
      passwordHash: await hash.make('correct horse'),
    })

    const missing = await download(client, recipient, id, fileId)
    const wrong = await download(client, recipient, id, fileId, 'wrong password')
    const right = await download(client, recipient, id, fileId, 'correct horse')

    missing.assertStatus(403)
    missing.assertBody({ error: 'invalid_password' })
    wrong.assertStatus(403)
    wrong.assertBody({ error: 'invalid_password' })
    right.assertStatus(200)
    const rows = await downloadRows(id)
    assert.sameMembers(
      rows.map((r) => Boolean(r.success)),
      [false, false, true]
    )
  })

  test('max_downloads=1: the second download is 410', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, recipient, { maxDownloads: 1 })

    const first = await download(client, recipient, id, fileId)
    const second = await download(client, creator, id, fileId)

    first.assertStatus(200)
    second.assertStatus(410)
    second.assertBody({ error: 'download_limit_reached' })
    const rows = await downloadRows(id)
    assert.sameMembers(
      rows.map((r) => Boolean(r.success)),
      [true, false]
    )
  })

  test('two concurrent requests with max_downloads=1 yield exactly one 200', async ({
    client,
    assert,
  }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, recipient, { maxDownloads: 1 })

    const responses = await Promise.all([
      download(client, recipient, id, fileId),
      download(client, creator, id, fileId),
    ])

    assert.sameMembers(
      responses.map((r) => r.status()),
      [200, 410]
    )
    const [{ total }] = await db
      .from('transfer_download')
      .where('transfer_id', id)
      .where('success', true)
      .count('* as total')
    assert.equal(Number(total), 1)
  })

  test('401 for guests', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, recipient)

    const response = await client
      .post(`/transfers/${id}/download/${fileId}`)
      .accept('json')
      .json({ password: null })
      .withCsrfToken()

    response.assertStatus(401)
  })
})
