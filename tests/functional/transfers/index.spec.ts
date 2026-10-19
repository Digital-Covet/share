import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Transfer from '#models/transfer'
import type User from '#models/user'
import { UserFactory } from '#database/factories/user_factory'
import { TransferFactory } from '#database/factories/transfer_factory'
import { signIn } from '#tests/helpers/sign_in'

type ListItem = {
  id: string
  isConfirmed: boolean
  isExpired: boolean
  fileCount: number
  totalBytes: number
  successfulDownloads: number
  creator: { id: string }
}

/**
 * A transfer from `creator` to `recipient`, with two file rows (11 + 4
 * bytes) when `confirmed`. Returns the id: Lucid replaces a self-assigned
 * id with the rowid on SQLite, so the model instance's id can't be trusted.
 */
async function makeTransfer(
  creator: User,
  recipient: User,
  { confirmed = true, expired = false, title = 'Q3 report' } = {}
) {
  const id = randomUUID()
  await TransferFactory.merge({
    id,
    createdBy: creator.id,
    title,
    expiresAt: DateTime.now().plus({ days: expired ? -1 : 7 }),
  }).create()
  await db
    .table('transfer_recipient')
    .insert({ id: randomUUID(), transfer_id: id, user_id: recipient.id })
  if (confirmed) {
    for (const size of [11, 4]) {
      const fileId = randomUUID()
      await db.table('transfer_file').insert({
        id: fileId,
        transfer_id: id,
        filename: `file-${size}.bin`,
        size_bytes: size,
        object_key: `transfers/${id}/${fileId}`,
      })
    }
  }
  return id
}

async function softDelete(id: string) {
  const transfer = await Transfer.findOrFail(id)
  await transfer.softDelete()
}

const ids = (items: ListItem[]) => items.map((item) => item.id).sort()

test.group('Transfers / index', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('sent tab lists my transfers, unconfirmed included, deleted excluded', async ({
    client,
    assert,
  }) => {
    const [me, other] = await UserFactory.createMany(2)
    const confirmed = await makeTransfer(me, other)
    const unconfirmed = await makeTransfer(me, other, { confirmed: false })
    const deleted = await makeTransfer(me, other)
    await softDelete(deleted)
    await makeTransfer(other, me)

    const response = await signIn(client.get('/transfers').withInertia(), me)

    response.assertStatus(200)
    response.assertInertiaComponent('transfers/index')
    const { tab, transfers } = response.inertiaProps as { tab: string; transfers: ListItem[] }
    assert.equal(tab, 'sent')
    assert.deepEqual(ids(transfers), [confirmed, unconfirmed].sort())

    const byId = new Map(transfers.map((t) => [t.id, t]))
    assert.isTrue(byId.get(confirmed)!.isConfirmed)
    assert.equal(byId.get(confirmed)!.fileCount, 2)
    assert.equal(byId.get(confirmed)!.totalBytes, 15)
    assert.equal(byId.get(confirmed)!.creator.id, me.id)
    assert.isFalse(byId.get(unconfirmed)!.isConfirmed)
    assert.equal(byId.get(unconfirmed)!.fileCount, 0)
    assert.equal(byId.get(unconfirmed)!.totalBytes, 0)
  })

  test('received tab lists confirmed transfers sent to me, expired included', async ({
    client,
    assert,
  }) => {
    const [me, sender, stranger] = await UserFactory.createMany(3)
    const active = await makeTransfer(sender, me)
    const expired = await makeTransfer(sender, me, { expired: true })
    await makeTransfer(sender, me, { confirmed: false })
    const deleted = await makeTransfer(sender, me)
    await softDelete(deleted)
    await makeTransfer(sender, stranger)
    await makeTransfer(me, sender)

    const response = await signIn(client.get('/transfers?tab=received').withInertia(), me)

    response.assertStatus(200)
    const { tab, transfers } = response.inertiaProps as { tab: string; transfers: ListItem[] }
    assert.equal(tab, 'received')
    assert.deepEqual(ids(transfers), [active, expired].sort())
    const byId = new Map(transfers.map((t) => [t.id, t]))
    assert.isFalse(byId.get(active)!.isExpired)
    assert.isTrue(byId.get(expired)!.isExpired)
    assert.equal(byId.get(active)!.creator.id, sender.id)
  })

  test("a stranger's transfers appear in neither tab", async ({ client, assert }) => {
    const [me, alice, bob] = await UserFactory.createMany(3)
    await makeTransfer(alice, bob)
    await makeTransfer(alice, bob, { confirmed: false })

    for (const tab of ['sent', 'received']) {
      const response = await signIn(client.get(`/transfers?tab=${tab}`).withInertia(), me)
      response.assertStatus(200)
      assert.lengthOf(response.inertiaProps.transfers, 0)
    }
  })

  test('counts only successful downloads', async ({ client, assert }) => {
    const [me, other] = await UserFactory.createMany(2)
    const id = await makeTransfer(me, other)
    for (const success of [true, true, false]) {
      await db
        .table('transfer_download')
        .insert({ id: randomUUID(), transfer_id: id, user_id: other.id, success })
    }

    const response = await signIn(client.get('/transfers').withInertia(), me)

    const [transfer] = response.inertiaProps.transfers as ListItem[]
    assert.equal(transfer.successfulDownloads, 2)
  })

  test('paginates 20 per page', async ({ client, assert }) => {
    const [me, other] = await UserFactory.createMany(2)
    for (let i = 0; i < 23; i++) await makeTransfer(me, other, { confirmed: i % 2 === 0 })

    const first = await signIn(client.get('/transfers').withInertia(), me)
    first.assertStatus(200)
    assert.lengthOf(first.inertiaProps.transfers, 20)
    assert.deepEqual(first.inertiaProps.pagination, {
      currentPage: 1,
      lastPage: 2,
      perPage: 20,
      total: 23,
    })

    const second = await signIn(client.get('/transfers?page=2').withInertia(), me)
    assert.lengthOf(second.inertiaProps.transfers, 3)
    assert.equal(second.inertiaProps.pagination.currentPage, 2)

    const all = [...first.inertiaProps.transfers, ...second.inertiaProps.transfers]
    assert.equal(new Set(all.map((t: ListItem) => t.id)).size, 23)
  })

  test('falls back to the sent tab and page 1 on bad input', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await signIn(client.get('/transfers?tab=nope&page=-3').withInertia(), user)

    response.assertStatus(200)
    assert.equal(response.inertiaProps.tab, 'sent')
    assert.equal(response.inertiaProps.pagination.currentPage, 1)
  })

  test('redirects guests to /login', async ({ client }) => {
    const response = await client.get('/transfers').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })
})

test.group('Dashboard', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('shows the 5 latest sent and received transfers', async ({ client, assert }) => {
    const [me, other] = await UserFactory.createMany(2)
    for (let i = 0; i < 6; i++) await makeTransfer(me, other)
    const received = await makeTransfer(other, me)
    await makeTransfer(other, me, { confirmed: false })

    const response = await signIn(client.get('/dashboard').withInertia(), me)

    response.assertStatus(200)
    response.assertInertiaComponent('dashboard')
    assert.lengthOf(response.inertiaProps.sent, 5)
    assert.deepEqual(ids(response.inertiaProps.received), [received])
  })
})
