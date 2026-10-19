import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Transfer from '#models/transfer'
import type User from '#models/user'
import TransferPolicy from '#policies/transfer_policy'
import { UserFactory } from '#database/factories/user_factory'
import { TransferFactory } from '#database/factories/transfer_factory'

/**
 * A transfer from `creator` to `recipient`, with a file row when `confirmed`.
 * Re-read by id: Lucid replaces a self-assigned id with the rowid on SQLite.
 */
async function makeTransfer(creator: User, recipient: User, { confirmed = true } = {}) {
  const id = randomUUID()
  await TransferFactory.merge({ id, createdBy: creator.id }).create()
  await db
    .table('transfer_recipient')
    .insert({ id: randomUUID(), transfer_id: id, user_id: recipient.id })
  if (confirmed) {
    const fileId = randomUUID()
    await db.table('transfer_file').insert({
      id: fileId,
      transfer_id: id,
      filename: 'a.txt',
      size_bytes: 1,
      object_key: `transfers/${id}/${fileId}`,
    })
  }
  return Transfer.findOrFail(id)
}

test.group('TransferPolicy', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creator and recipient can view and download a confirmed transfer', async ({ assert }) => {
    const [creator, recipient, stranger] = await UserFactory.createMany(3)
    const transfer = await makeTransfer(creator, recipient)

    assert.isTrue(await TransferPolicy.canView(creator, transfer))
    assert.isTrue(await TransferPolicy.canView(recipient, transfer))
    assert.isFalse(await TransferPolicy.canView(stranger, transfer))

    assert.isTrue(await TransferPolicy.canDownload(creator, transfer))
    assert.isTrue(await TransferPolicy.canDownload(recipient, transfer))
    assert.isFalse(await TransferPolicy.canDownload(stranger, transfer))
  })

  test('only the creator can view an unconfirmed transfer, and nobody can download', async ({
    assert,
  }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const transfer = await makeTransfer(creator, recipient, { confirmed: false })

    assert.isTrue(await TransferPolicy.canView(creator, transfer))
    assert.isFalse(await TransferPolicy.canView(recipient, transfer))

    assert.isFalse(await TransferPolicy.canDownload(creator, transfer))
    assert.isFalse(await TransferPolicy.canDownload(recipient, transfer))
  })

  test('nobody can view or download a deleted transfer', async ({ assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const transfer = await makeTransfer(creator, recipient)
    await transfer.softDelete()

    assert.isFalse(await TransferPolicy.canView(creator, transfer))
    assert.isFalse(await TransferPolicy.canDownload(recipient, transfer))
  })

  test('admins can view and delete confirmed transfers but not download', async ({ assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const admin = await UserFactory.merge({ role: 'admin' }).create()
    const superadmin = await UserFactory.merge({ role: 'superadmin' }).create()
    const transfer = await makeTransfer(creator, recipient)

    for (const user of [admin, superadmin]) {
      assert.isTrue(await TransferPolicy.canView(user, transfer))
      assert.isTrue(await TransferPolicy.canDelete(user, transfer))
      assert.isFalse(await TransferPolicy.canDownload(user, transfer))
    }
  })

  test("admins can't see or delete unconfirmed transfers of others", async ({ assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const admin = await UserFactory.merge({ role: 'admin' }).create()
    const transfer = await makeTransfer(creator, recipient, { confirmed: false })

    assert.isFalse(await TransferPolicy.canView(admin, transfer))
    assert.isFalse(await TransferPolicy.canDelete(admin, transfer))
  })

  test('creator can delete confirmed or not; recipients and strangers cannot', async ({
    assert,
  }) => {
    const [creator, recipient, stranger] = await UserFactory.createMany(3)
    const confirmed = await makeTransfer(creator, recipient)
    const unconfirmed = await makeTransfer(creator, recipient, { confirmed: false })

    assert.isTrue(await TransferPolicy.canDelete(creator, confirmed))
    assert.isTrue(await TransferPolicy.canDelete(creator, unconfirmed))
    assert.isFalse(await TransferPolicy.canDelete(recipient, confirmed))
    assert.isFalse(await TransferPolicy.canDelete(stranger, confirmed))
  })

  test('custom role names are treated as employees', async ({ assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const custom = await UserFactory.merge({ role: 'team-lead' }).create()
    const transfer = await makeTransfer(creator, recipient)

    assert.isFalse(custom.isAdmin)
    assert.isFalse(await TransferPolicy.canView(custom, transfer))
    assert.isFalse(await TransferPolicy.canDelete(custom, transfer))
  })

  test('findViewableOrFail throws for a stranger', async ({ assert }) => {
    const [creator, recipient, stranger] = await UserFactory.createMany(3)
    const transfer = await makeTransfer(creator, recipient)

    const found = await TransferPolicy.findViewableOrFail(recipient, transfer.id)
    assert.equal(found.id, transfer.id)
    await assert.rejects(() => TransferPolicy.findViewableOrFail(stranger, transfer.id))
  })
})
