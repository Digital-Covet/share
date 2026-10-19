import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import { signIn } from '#tests/helpers/sign_in'

test.group('Smoke', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('dashboard redirects guests to /login', async ({ client }) => {
    const response = await client.get('/dashboard').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('root redirects to the dashboard', async ({ client }) => {
    const response = await client.get('/').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/dashboard')
  })

  test('login page is noindex and carries link-preview metadata', async ({ client, assert }) => {
    const response = await client.get('/login')

    response.assertStatus(200)
    response.assertHeader('x-robots-tag', 'noindex, nofollow')
    assert.include(response.text(), '<meta name="robots" content="noindex, nofollow" />')
    assert.match(
      response.text(),
      /<meta property="og:image" content="https?:\/\/[^"]+\/og-image\.png" \/>/
    )
    assert.include(response.text(), '<html lang="en"')
  })

  test('robots.txt disallows crawling', async ({ client, assert }) => {
    const response = await client.get('/robots.txt')

    response.assertStatus(200)
    assert.include(response.text(), 'Disallow: /')
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
