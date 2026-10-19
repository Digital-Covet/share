import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Transfer from '#models/transfer'
import type User from '#models/user'
import { UserFactory } from '#database/factories/user_factory'
import { TransferFactory } from '#database/factories/transfer_factory'
import { signIn } from '#tests/helpers/sign_in'

/**
 * A transfer from `creator` to `recipient`, with two file rows when
 * `confirmed`. Returns the id: Lucid replaces a self-assigned id with the
 * rowid on SQLite, so the model instance's id can't be trusted.
 */
async function makeTransfer(creator: User, recipient: User, { confirmed = true } = {}) {
  const id = randomUUID()
  await TransferFactory.merge({ id, createdBy: creator.id, title: 'Q3 report' }).create()
  await db
    .table('transfer_recipient')
    .insert({ id: randomUUID(), transfer_id: id, user_id: recipient.id })
  if (confirmed) {
    for (const [filename, size] of [
      ['report.pdf', 11],
      ['data.bin', 4],
    ] as const) {
      const fileId = randomUUID()
      await db.table('transfer_file').insert({
        id: fileId,
        transfer_id: id,
        filename,
        size_bytes: size,
        object_key: `transfers/${id}/${fileId}`,
      })
    }
  }
  return id
}

test.group('Transfers / show', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creator sees the transfer with files and recipients', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const id = await makeTransfer(creator, recipient)

    const response = await signIn(client.get(`/transfers/${id}`).withInertia(), creator)

    response.assertStatus(200)
    response.assertInertiaComponent('transfers/show')
    const { transfer } = response.inertiaProps
    assert.equal(transfer.id, id)
    assert.equal(transfer.title, 'Q3 report')
    assert.isTrue(transfer.isConfirmed)
    assert.isFalse(transfer.isExpired)
    assert.isFalse(transfer.hasPassword)
    assert.equal(transfer.creator.id, creator.id)
    assert.equal(transfer.successfulDownloads, 0)
    assert.deepEqual(
      transfer.files.map((f: { filename: string; sizeBytes: number }) => [f.filename, f.sizeBytes]),
      [
        ['data.bin', 4],
        ['report.pdf', 11],
      ]
    )
    assert.deepEqual(
      transfer.recipients.map((r: { id: string }) => r.id),
      [recipient.id]
    )
  })

  test('recipient sees the transfer without the recipients list', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const id = await makeTransfer(creator, recipient)

    const response = await signIn(client.get(`/transfers/${id}`).withInertia(), recipient)

    response.assertStatus(200)
    const { transfer } = response.inertiaProps
    assert.lengthOf(transfer.files, 2)
    assert.notProperty(transfer, 'recipients')
  })

  test('404 for a stranger', async ({ client }) => {
    const [creator, recipient, stranger] = await UserFactory.createMany(3)
    const id = await makeTransfer(creator, recipient)

    const response = await signIn(client.get(`/transfers/${id}`).withInertia(), stranger)

    response.assertStatus(404)
  })

  test('creator sees an unconfirmed transfer with no files', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const id = await makeTransfer(creator, recipient, { confirmed: false })

    const response = await signIn(client.get(`/transfers/${id}`).withInertia(), creator)

    response.assertStatus(200)
    const { transfer } = response.inertiaProps
    assert.isFalse(transfer.isConfirmed)
    assert.lengthOf(transfer.files, 0)
  })

  test('404 for a recipient of an unconfirmed transfer', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const id = await makeTransfer(creator, recipient, { confirmed: false })

    const response = await signIn(client.get(`/transfers/${id}`).withInertia(), recipient)

    response.assertStatus(404)
  })

  test('404 for a deleted transfer, even for its creator', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const id = await makeTransfer(creator, recipient)
    const transfer = await Transfer.findOrFail(id)
    await transfer.softDelete()

    const response = await signIn(client.get(`/transfers/${id}`).withInertia(), creator)

    response.assertStatus(404)
  })

  test('404 for a non-uuid id', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await signIn(client.get('/transfers/not-a-uuid'), user)

    response.assertStatus(404)
  })

  test('redirects guests to /login', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const id = await makeTransfer(creator, recipient)

    const response = await client.get(`/transfers/${id}`).redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })
})
