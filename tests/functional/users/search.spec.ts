import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import type User from '#models/user'
import { UserFactory } from '#database/factories/user_factory'
import { signIn } from '#tests/helpers/sign_in'

const search = (client: ApiClient, user: User, q: string) =>
  signIn(client.get('/users/search').qs({ q }).accept('json'), user)

test.group('Users / search', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('matches by name, case-insensitively', async ({ client, assert }) => {
    const me = await UserFactory.create()
    const ada = await UserFactory.merge({ name: 'Ada Lovelace', email: 'ada@example.com' }).create()
    await UserFactory.merge({ name: 'Grace Hopper', email: 'grace@example.com' }).create()

    const response = await search(client, me, 'LOVE')

    response.assertStatus(200)
    response.assertBody([
      { id: ada.id, name: 'Ada Lovelace', email: 'ada@example.com', initials: 'AL' },
    ])
    assert.lengthOf(response.body(), 1)
  })

  test('matches by email', async ({ client, assert }) => {
    const me = await UserFactory.create()
    const grace = await UserFactory.merge({
      name: 'Grace Hopper',
      email: 'g.hopper@navy.test',
    }).create()

    const response = await search(client, me, 'navy.test')

    response.assertStatus(200)
    assert.deepEqual(
      response.body().map((u: { id: string }) => u.id),
      [grace.id]
    )
  })

  test('treats LIKE wildcards literally', async ({ client }) => {
    const me = await UserFactory.create()
    await UserFactory.merge({ name: 'Plain Name', email: 'plain@example.com' }).create()

    const response = await search(client, me, '%%')

    response.assertBody([])
  })

  test('excludes the current user', async ({ client }) => {
    const me = await UserFactory.merge({
      name: 'Searcher Self',
      email: 'self@example.com',
    }).create()

    const response = await search(client, me, 'searcher')

    response.assertStatus(200)
    response.assertBody([])
  })

  test('returns [] for queries shorter than 2 characters', async ({ client }) => {
    const me = await UserFactory.create()
    await UserFactory.merge({ name: 'Ab Cd', email: 'abcd@example.com' }).create()

    const one = await search(client, me, 'a')
    const blank = await search(client, me, '   ')

    one.assertStatus(200)
    one.assertBody([])
    blank.assertBody([])
  })

  test('returns at most 10 users', async ({ client, assert }) => {
    const me = await UserFactory.create()
    for (let i = 0; i < 12; i++) {
      await UserFactory.merge({
        name: `Team Member ${i}`,
        email: `member${i}@example.com`,
      }).create()
    }

    const response = await search(client, me, 'team member')

    response.assertStatus(200)
    assert.lengthOf(response.body(), 10)
  })

  test('requires authentication', async ({ client }) => {
    const response = await client.get('/users/search').qs({ q: 'ada' }).accept('json')

    response.assertStatus(401)
  })
})
