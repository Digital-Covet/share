import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import CleanupService from '#services/cleanup_service'
import StorageService from '#services/storage_service'
import { UserFactory } from '#database/factories/user_factory'
import { TransferFactory } from '#database/factories/transfer_factory'

const sqlTime = (value: DateTime) => value.toFormat(db.connection().dialect.dateTimeFormat)

type Options = {
  confirmed?: boolean
  files?: number
  expiresAt?: DateTime
  createdAt?: DateTime
  deletedAt?: DateTime
}

/**
 * A transfer whose objects exist on the fake disk. Confirmed transfers get
 * `files` file rows; unconfirmed ones only get objects under their prefix
 * (an upload that was never completed). Timestamps are written with SQL so
 * Lucid's auto timestamps don't override them.
 */
async function makeTransfer({
  confirmed = true,
  files = 1,
  expiresAt = DateTime.now().plus({ days: 7 }),
  createdAt = DateTime.now(),
  deletedAt,
}: Options = {}) {
  const creator = await UserFactory.create()
  const id = randomUUID()
  await TransferFactory.merge({ id, createdBy: creator.id }).create()
  await db
    .from('transfer')
    .where('id', id)
    .update({
      expires_at: sqlTime(expiresAt),
      created_at: sqlTime(createdAt),
      deleted_at: deletedAt ? sqlTime(deletedAt) : null,
    })

  const keys: string[] = []
  for (let i = 0; i < files; i++) {
    const fileId = randomUUID()
    const key = `transfers/${id}/${fileId}`
    keys.push(key)
    await drive.use().put(key, 'bytes')
    if (confirmed) {
      await db.table('transfer_file').insert({
        id: fileId,
        transfer_id: id,
        filename: `${i}.txt`,
        size_bytes: 5,
        object_key: key,
      })
    }
  }
  return { id, keys }
}

/** `deleted_at` of the transfer row. */
async function transferDeletedAt(id: string) {
  const row = await db.from('transfer').where('id', id).firstOrFail()
  return row.deleted_at
}

/** `deleted_at` of the transfer's first file row. */
async function firstFileDeletedAt(id: string) {
  const row = await db.from('transfer_file').where('transfer_id', id).firstOrFail()
  return row.deleted_at
}

const fileRows = (id: string) => db.from('transfer_file').where('transfer_id', id)
const exists = (key: string) => drive.use().exists(key)

test.group('CleanupService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    const fake = drive.fake()
    return () => {
      fake.clear()
      drive.restore()
    }
  })

  test('soft-deletes an expired transfer and removes its objects', async ({ assert }) => {
    const { id, keys } = await makeTransfer({
      files: 2,
      expiresAt: DateTime.now().minus({ minutes: 1 }),
    })

    const result = await CleanupService.run()

    assert.deepEqual(result, { expired: 1, abandoned: 0, filesDeleted: 2, prefixesPurged: 0 })
    assert.isNotNull(await transferDeletedAt(id))
    for (const file of await fileRows(id)) assert.isNotNull(file.deleted_at)
    for (const key of keys) assert.isFalse(await exists(key))
  })

  test('leaves an unexpired confirmed transfer alone', async ({ assert }) => {
    const { id, keys } = await makeTransfer({ createdAt: DateTime.now().minus({ days: 3 }) })

    const result = await CleanupService.run()

    assert.deepEqual(result, { expired: 0, abandoned: 0, filesDeleted: 0, prefixesPurged: 0 })
    assert.isNull(await transferDeletedAt(id))
    assert.isNull(await firstFileDeletedAt(id))
    assert.isTrue(await exists(keys[0]))
  })

  test('soft-deletes an unconfirmed transfer older than 24 h and purges its prefix', async ({
    assert,
  }) => {
    const { id, keys } = await makeTransfer({
      confirmed: false,
      files: 2,
      createdAt: DateTime.now().minus({ hours: 25 }),
    })
    const other = await makeTransfer()

    const result = await CleanupService.run()

    assert.deepEqual(result, { expired: 0, abandoned: 1, filesDeleted: 0, prefixesPurged: 1 })
    assert.isNotNull(await transferDeletedAt(id))
    for (const key of keys) assert.isFalse(await exists(key))
    assert.isTrue(await exists(other.keys[0]))
  })

  test('leaves an unconfirmed transfer younger than 24 h alone', async ({ assert }) => {
    const { id, keys } = await makeTransfer({
      confirmed: false,
      createdAt: DateTime.now().minus({ hours: 23 }),
    })

    const result = await CleanupService.run()

    assert.deepEqual(result, { expired: 0, abandoned: 0, filesDeleted: 0, prefixesPurged: 0 })
    assert.isNull(await transferDeletedAt(id))
    assert.isTrue(await exists(keys[0]))
  })

  test('removes the objects of a transfer a user soft-deleted', async ({ assert }) => {
    const { id, keys } = await makeTransfer({ deletedAt: DateTime.now().minus({ hours: 1 }) })

    const result = await CleanupService.run()

    assert.deepEqual(result, { expired: 0, abandoned: 0, filesDeleted: 1, prefixesPurged: 0 })
    assert.isNotNull(await firstFileDeletedAt(id))
    assert.isFalse(await exists(keys[0]))
  })

  test('a missing object does not fail the run', async ({ assert }) => {
    const { id, keys } = await makeTransfer({ deletedAt: DateTime.now() })
    await drive.use().delete(keys[0])

    const result = await CleanupService.run()

    assert.equal(result.filesDeleted, 1)
    assert.isNotNull(await firstFileDeletedAt(id))
  })

  test('running twice changes nothing the second time', async ({ assert }) => {
    await makeTransfer({ expiresAt: DateTime.now().minus({ days: 1 }) })
    await makeTransfer({ deletedAt: DateTime.now() })
    const kept = await makeTransfer()

    await CleanupService.run()
    const before = await db.from('transfer').orderBy('id')
    const result = await CleanupService.run()

    assert.deepEqual(result, { expired: 0, abandoned: 0, filesDeleted: 0, prefixesPurged: 0 })
    assert.deepEqual(await db.from('transfer').orderBy('id'), before)
    assert.isTrue(await exists(kept.keys[0]))
  })

  test('a failed object delete leaves the file for the next run', async ({ assert, cleanup }) => {
    const { id, keys } = await makeTransfer({ files: 2, deletedAt: DateTime.now() })
    const failing = keys[0]
    const original = StorageService.delete
    StorageService.delete = async (key: string) => {
      if (key === failing) throw new Error('storage unavailable')
      return original.call(StorageService, key)
    }
    cleanup(() => {
      StorageService.delete = original
    })

    const first = await CleanupService.run()

    assert.equal(first.filesDeleted, 1)
    const files = await fileRows(id)
    assert.isNull(files.find((file) => file.object_key === failing)!.deleted_at)
    assert.isNotNull(files.find((file) => file.object_key === keys[1])!.deleted_at)
    assert.isTrue(await exists(failing))

    StorageService.delete = original
    const second = await CleanupService.run()

    assert.equal(second.filesDeleted, 1)
    for (const file of await fileRows(id)) assert.isNotNull(file.deleted_at)
    assert.isFalse(await exists(failing))
  })
})
