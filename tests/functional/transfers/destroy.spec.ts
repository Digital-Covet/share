import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import type User from '#models/user'
import { UserFactory } from '#database/factories/user_factory'
import { TransferFactory } from '#database/factories/transfer_factory'
import { signIn } from '#tests/helpers/sign_in'

/**
 * A transfer from `creator` to `recipient`, with one file row when
 * `confirmed`. Returns the ids: Lucid replaces a self-assigned id with the
 * rowid on SQLite, so the model instance's id can't be trusted.
 */
async function makeTransfer(creator: User, recipient: User, { confirmed = true } = {}) {
  const id = randomUUID()
  const fileId = randomUUID()
  await TransferFactory.merge({ id, createdBy: creator.id, title: 'Q3 report' }).create()
  await db
    .table('transfer_recipient')
    .insert({ id: randomUUID(), transfer_id: id, user_id: recipient.id })
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

const destroy = (client: ApiClient, id: string, user: User) =>
  signIn(client.delete(`/transfers/${id}`).accept('json').withCsrfToken(), user)

const deletedAt = async (id: string) => {
  const row = await db.from('transfer').where('id', id).firstOrFail()
  return row.deleted_at
}

test.group('Transfers / destroy', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creator deletes a confirmed transfer', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id } = await makeTransfer(creator, recipient)

    const response = await destroy(client, id, creator)

    response.assertStatus(204)
    assert.isNotNull(await deletedAt(id))
  })

  test('creator deletes an unconfirmed transfer', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id } = await makeTransfer(creator, recipient, { confirmed: false })

    const response = await destroy(client, id, creator)

    response.assertStatus(204)
    assert.isNotNull(await deletedAt(id))
  })

  test("admin deletes someone else's confirmed transfer", async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const admin = await UserFactory.merge({ role: 'admin' }).create()
    const { id } = await makeTransfer(creator, recipient)

    const response = await destroy(client, id, admin)

    response.assertStatus(204)
    assert.isNotNull(await deletedAt(id))
  })

  test('superadmin deletes too', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const superadmin = await UserFactory.merge({ role: 'superadmin' }).create()
    const { id } = await makeTransfer(creator, recipient)

    const response = await destroy(client, id, superadmin)

    response.assertStatus(204)
  })

  test("404 for an admin on someone else's unconfirmed transfer", async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const admin = await UserFactory.merge({ role: 'admin' }).create()
    const { id } = await makeTransfer(creator, recipient, { confirmed: false })

    const response = await destroy(client, id, admin)

    response.assertStatus(404)
    assert.isNull(await deletedAt(id))
  })

  test('403 for a recipient', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id } = await makeTransfer(creator, recipient)

    const response = await destroy(client, id, recipient)

    response.assertStatus(403)
    response.assertBody({ error: 'forbidden' })
    assert.isNull(await deletedAt(id))
  })

  test('404 for a stranger', async ({ client, assert }) => {
    const [creator, recipient, stranger] = await UserFactory.createMany(3)
    const { id } = await makeTransfer(creator, recipient)

    const response = await destroy(client, id, stranger)

    response.assertStatus(404)
    assert.isNull(await deletedAt(id))
  })

  test('404 when already deleted', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id } = await makeTransfer(creator, recipient)
    await destroy(client, id, creator)

    const response = await destroy(client, id, creator)

    response.assertStatus(404)
  })

  test('a user with a custom role is not an admin', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const custom = await UserFactory.merge({ role: 'team-lead' }).create()
    const { id } = await makeTransfer(creator, recipient)

    assert.isFalse(custom.isAdmin)
    const deleted = await destroy(client, id, custom)
    deleted.assertStatus(404)
    const shown = await signIn(client.get(`/transfers/${id}`).withInertia(), custom)
    shown.assertStatus(404)
  })

  test('Inertia submissions redirect to the list with a flash', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id } = await makeTransfer(creator, recipient)

    const response = await signIn(
      client.delete(`/transfers/${id}`).withInertia().withCsrfToken().redirects(0),
      creator
    )

    response.assertHeader('location', '/transfers')
    response.assertFlashMessage('success', 'Transfer deleted')
  })

  test('a deleted transfer disappears from lists, show and download', async ({
    client,
    assert,
  }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const { id, fileId } = await makeTransfer(creator, recipient)
    await destroy(client, id, creator)

    const sent = await signIn(client.get('/transfers?tab=sent').withInertia(), creator)
    const received = await signIn(client.get('/transfers?tab=received').withInertia(), recipient)
    assert.lengthOf(sent.inertiaProps.transfers, 0)
    assert.lengthOf(received.inertiaProps.transfers, 0)

    const shown = await signIn(client.get(`/transfers/${id}`).withInertia(), recipient)
    shown.assertStatus(404)

    const download = await signIn(
      client
        .post(`/transfers/${id}/download/${fileId}`)
        .accept('json')
        .json({ password: null })
        .withCsrfToken(),
      recipient
    )
    download.assertStatus(404)
  })

  test('show tells the page whether delete is allowed', async ({ client, assert }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const admin = await UserFactory.merge({ role: 'admin' }).create()
    const { id } = await makeTransfer(creator, recipient)

    const canDelete = async (user: User) => {
      const response = await signIn(client.get(`/transfers/${id}`).withInertia(), user)
      return response.inertiaProps.canDelete
    }

    assert.isTrue(await canDelete(creator))
    assert.isTrue(await canDelete(admin))
    assert.isFalse(await canDelete(recipient))
  })
})

test.group('Transfers / admin access', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('admin can view any confirmed transfer but not download it', async ({ client }) => {
    const [creator, recipient] = await UserFactory.createMany(2)
    const admin = await UserFactory.merge({ role: 'admin' }).create()
    const { id, fileId } = await makeTransfer(creator, recipient)

    const shown = await signIn(client.get(`/transfers/${id}`).withInertia(), admin)
    shown.assertStatus(200)

    const download = await signIn(
      client
        .post(`/transfers/${id}/download/${fileId}`)
        .accept('json')
        .json({ password: null })
        .withCsrfToken(),
      admin
    )
    download.assertStatus(403)
    download.assertBody({ error: 'forbidden' })
  })

  test('the "All" tab lists every confirmed transfer, for admins only', async ({
    client,
    assert,
  }) => {
    const [creator, recipient, other] = await UserFactory.createMany(3)
    const admin = await UserFactory.merge({ role: 'admin' }).create()
    const { id: confirmed } = await makeTransfer(creator, recipient)
    await makeTransfer(creator, recipient, { confirmed: false })
    const { id: deleted } = await makeTransfer(other, recipient)
    await destroy(client, deleted, other)

    const asAdmin = await signIn(client.get('/transfers?tab=all').withInertia(), admin)
    assert.equal(asAdmin.inertiaProps.tab, 'all')
    assert.isTrue(asAdmin.inertiaProps.canSeeAll)
    assert.deepEqual(
      asAdmin.inertiaProps.transfers.map((t: { id: string }) => t.id),
      [confirmed]
    )

    const asEmployee = await signIn(client.get('/transfers?tab=all').withInertia(), creator)
    assert.equal(asEmployee.inertiaProps.tab, 'sent')
    assert.isFalse(asEmployee.inertiaProps.canSeeAll)
  })
})
