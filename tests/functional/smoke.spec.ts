import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'

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

  test('dashboard renders for a signed-in user', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.get('/dashboard').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('dashboard')
  })
})
