import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import { signIn } from '#tests/helpers/sign_in'

test.group('Smoke', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('home page renders', async ({ client }) => {
    const response = await client.get('/').withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('home')
  })

  test('dashboard redirects guests to /login', async ({ client }) => {
    const response = await client.get('/dashboard').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('dashboard renders for a signed-in user', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await signIn(client.get('/dashboard').withInertia(), user)

    response.assertStatus(200)
    response.assertInertiaComponent('dashboard')
    assert.deepEqual(response.inertiaProps.sent, [])
    assert.deepEqual(response.inertiaProps.received, [])
  })
})
