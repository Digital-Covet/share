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
import { objectKey } from '#services/transfer_service'
import { UserFactory } from '#database/factories/user_factory'
import { TransferFactory } from '#database/factories/transfer_factory'
import { signIn } from '#tests/helpers/sign_in'

const FILES = [
  { filename: 'report.pdf', sizeBytes: 11, mimeType: 'application/pdf' },
  { filename: 'data.bin', sizeBytes: 4, mimeType: null },
]

const body = (recipientIds: string[], overrides: Record<string, unknown> = {}) => ({
  title: 'Q3 report',
  message: 'See attached',
  expiresAt: DateTime.now().plus({ days: 7 }).toISO(),
  maxDownloads: null,
  password: null,
  recipientIds,
  files: FILES,
  ...overrides,
})

const createTransfer = (client: ApiClient, user: User, payload: object) =>
  signIn(client.post('/transfers').accept('json').json(payload).withCsrfToken(), user)

const complete = (client: ApiClient, user: User, transferId: string, uploadToken: string) =>
  signIn(
    client
      .post(`/transfers/${transferId}/complete`)
      .accept('json')
      .json({ uploadToken })
      .withCsrfToken(),
    user
  )

/** Put objects of the declared sizes where the presigned PUTs would have. */
const fakeUploads = async (
  transferId: string,
  fileIds: string[],
  sizes = FILES.map((f) => f.sizeBytes)
) => {
  for (const [i, fileId] of fileIds.entries()) {
    await drive.use().put(objectKey(transferId, fileId), 'x'.repeat(sizes[i]))
  }
}

const fileRowCount = async (transferId: string) => {
  const [{ total }] = await db
    .from('transfer_file')
    .where('transfer_id', transferId)
    .count('* as total')
  return Number(total)
}

test.group('Transfers / create', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    const fake = drive.fake()
    return () => {
      fake.clear()
      drive.restore()
    }
  })

  test('returns the transfer id, upload token and one presigned PUT per file', async ({
    client,
    assert,
  }) => {
    const [creator, recipient] = await UserFactory.createMany(2)

    const response = await createTransfer(client, creator, body([recipient.id, recipient.id]))

    response.assertStatus(201)
    const { transferId, uploadToken, uploads } = response.body()
    assert.isString(transferId)
    assert.isString(uploadToken)
    assert.lengthOf(uploads, 2)
    for (const upload of uploads) {
      assert.equal(upload.method, 'PUT')
      assert.include(upload.url, objectKey(transferId, upload.fileId))
    }
    assert.deepEqual(uploads[0].headers, { 'Content-Type': 'application/pdf' })
    assert.deepEqual(uploads[1].headers, { 'Content-Type': 'application/octet-stream' })

    const transfer = await Transfer.findOrFail(transferId)
    assert.equal(transfer.createdBy, creator.id)
    assert.equal(transfer.title, 'Q3 report')
    assert.isNull(transfer.passwordHash)

    const recipients = await db.from('transfer_recipient').where('transfer_id', transferId)
    assert.deepEqual(
      recipients.map((r) => r.user_id),
      [recipient.id]
    )
    assert.equal(await fileRowCount(transferId), 0)
  })

  test('stores the password hashed', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)

    const response = await createTransfer(
      client,
      creator,
      body([recipient.id], { password: 'correct horse' })
    )

    response.assertStatus(201)
    const transfer = await Transfer.findOrFail(response.body().transferId)
    assert.isString(transfer.passwordHash)
    assert.notEqual(transfer.passwordHash, 'correct horse')
    assert.isTrue(await hash.verify(transfer.passwordHash!, 'correct horse'))
  })

  test('rejects {name}')
    .with([
      {
        name: 'a file over the size cap',
        field: 'files.0.sizeBytes',
        overrides: { files: [{ filename: 'big.iso', sizeBytes: 5363466241, mimeType: null }] },
      },
      { name: 'an empty file list', field: 'files', overrides: { files: [] } },
      {
        name: 'a past expiry',
        field: 'expiresAt',
        overrides: { expiresAt: DateTime.now().minus({ minutes: 1 }).toISO() },
      },
      {
        name: 'an expiry over 30 days away',
        field: 'expiresAt',
        overrides: { expiresAt: DateTime.now().plus({ days: 31 }).toISO() },
      },
      {
        name: 'an unknown recipient',
        field: 'recipientIds.0',
        overrides: { recipientIds: ['3f2b6c1e-8a4d-4c7e-9b1a-2d3e4f5a6b7c'] },
      },
      { name: 'no recipients', field: 'recipientIds', overrides: { recipientIds: [] } },
    ])
    .run(async ({ client, assert }, { field, overrides }) => {
      const [creator, recipient] = await UserFactory.createMany(2)

      const response = await createTransfer(client, creator, body([recipient.id], overrides))

      response.assertStatus(422)
      assert.includeMembers(
        response.body().errors.map((e: { field: string }) => e.field),
        [field]
      )
      assert.isNull(await Transfer.findBy('createdBy', creator.id))
    })

  test('rejects the creator as a recipient', async ({ client }) => {
    const creator = await UserFactory.create()

    const response = await createTransfer(client, creator, body([creator.id]))

    response.assertStatus(422)
  })

  test('requires authentication', async ({ client }) => {
    const recipient = await UserFactory.create()

    const response = await client
      .post('/transfers')
      .accept('json')
      .json(body([recipient.id]))
      .withCsrfToken()

    response.assertStatus(401)
  })
})

test.group('Transfers / complete', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    const fake = drive.fake()
    return () => {
      fake.clear()
      drive.restore()
    }
  })

  /** Create a transfer through the API and return the 201 body. */
  const start = async (client: ApiClient) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const response = await createTransfer(client, creator, body([recipient.id]))
    response.assertStatus(201)
    const created = response.body() as {
      transferId: string
      uploadToken: string
      uploads: Array<{ fileId: string }>
    }
    return { creator, recipient, ...created, fileIds: created.uploads.map((u) => u.fileId) }
  }

  test('409 files_missing when an object is absent, and writes nothing', async ({
    client,
    assert,
  }) => {
    const { creator, transferId, uploadToken, fileIds } = await start(client)
    await fakeUploads(transferId, [fileIds[0]])

    const response = await complete(client, creator, transferId, uploadToken)

    response.assertStatus(409)
    response.assertBody({ error: 'files_missing', fileIds: [fileIds[1]] })
    assert.equal(await fileRowCount(transferId), 0)
  })

  test('409 size_mismatch when an object has a different size', async ({ client, assert }) => {
    const { creator, transferId, uploadToken, fileIds } = await start(client)
    await fakeUploads(transferId, fileIds, [11, 5])

    const response = await complete(client, creator, transferId, uploadToken)

    response.assertStatus(409)
    response.assertBody({ error: 'size_mismatch', fileIds: [fileIds[1]] })
    assert.equal(await fileRowCount(transferId), 0)
  })

  test('writes the manifest rows once and is idempotent', async ({ client, assert }) => {
    const { creator, transferId, uploadToken, fileIds } = await start(client)
    await fakeUploads(transferId, fileIds)

    const first = await complete(client, creator, transferId, uploadToken)
    first.assertStatus(200)
    first.assertBody({ transferId, firstConfirmation: true })

    const rows = await db.from('transfer_file').where('transfer_id', transferId).orderBy('filename')
    assert.sameMembers(
      rows.map((r) => r.id),
      fileIds
    )
    const report = rows.find((r) => r.filename === 'report.pdf')
    assert.equal(Number(report.size_bytes), 11)
    assert.equal(report.mime_type, 'application/pdf')
    assert.equal(report.object_key, objectKey(transferId, report.id))

    const second = await complete(client, creator, transferId, uploadToken)
    second.assertStatus(200)
    second.assertBody({ transferId, firstConfirmation: false })
    assert.equal(await fileRowCount(transferId), 2)
  })

  test('422 for a tampered token', async ({ client }) => {
    const { creator, transferId, uploadToken, fileIds } = await start(client)
    await fakeUploads(transferId, fileIds)
    const i = Math.floor(uploadToken.length / 2)
    const tampered =
      uploadToken.slice(0, i) + (uploadToken[i] === 'a' ? 'b' : 'a') + uploadToken.slice(i + 1)

    const response = await complete(client, creator, transferId, tampered)

    response.assertStatus(422)
    response.assertBody({ error: 'invalid_upload_token' })
  })

  test('422 for a token issued for another transfer', async ({ client }) => {
    const { creator, recipient, uploadToken } = await start(client)
    const other = await createTransfer(client, creator, body([recipient.id]))

    const response = await complete(client, creator, other.body().transferId, uploadToken)

    response.assertStatus(422)
    response.assertBody({ error: 'invalid_upload_token' })
  })

  test('404 for anyone but the creator', async ({ client, assert }) => {
    const { recipient, transferId, uploadToken, fileIds } = await start(client)
    await fakeUploads(transferId, fileIds)

    const response = await complete(client, recipient, transferId, uploadToken)

    response.assertStatus(404)
    assert.equal(await fileRowCount(transferId), 0)
  })

  test('404 for a deleted transfer', async ({ client }) => {
    const { creator, transferId, uploadToken, fileIds } = await start(client)
    await fakeUploads(transferId, fileIds)
    const transfer = await Transfer.findOrFail(transferId)
    await transfer.softDelete()

    const response = await complete(client, creator, transferId, uploadToken)

    response.assertStatus(404)
  })

  test('401 when signed out', async ({ client }) => {
    // Kept aside: Lucid replaces a self-assigned id with the rowid on SQLite.
    const id = randomUUID()
    await TransferFactory.with('creator').merge({ id }).create()

    const response = await client
      .post(`/transfers/${id}/complete`)
      .accept('json')
      .json({ uploadToken: 'x' })
      .withCsrfToken()

    response.assertStatus(401)
  })
})
