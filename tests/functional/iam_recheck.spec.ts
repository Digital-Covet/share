import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient, ApiRequest } from '@japa/api-client'
import IamGrant from '#models/iam_grant'
import User from '#models/user'
import IamClient, { IamError, IamGrantRevoked, type IamIdentity } from '#services/iam_client'
import { UserFactory } from '#database/factories/user_factory'
import { IamGrantFactory } from '#database/factories/iam_grant_factory'
import { GRANT_KEY, ID_TOKEN_KEY } from '#controllers/iam_controller'
import { signIn } from '#tests/helpers/sign_in'

const SIGNED_OUT = 'Your access to Share has changed. Please sign in again.'

/**
 * Replaces IAM's token endpoint for one test: `refresh` answers with
 * `outcome`, and `verifyIdToken` returns `identity` for the issued ID token.
 * Every call is recorded.
 */
function fakeIam(user: User) {
  const calls = { refresh: [] as string[], revoke: [] as string[], verify: [] as string[] }
  const state = {
    outcome: 'ok' as 'ok' | 'invalid_grant' | 'unreachable',
    identity: (): IamIdentity => ({
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: null,
      appAccess: ['share'],
      role: user.role,
    }),
  }
  const original = {
    refresh: IamClient.refresh,
    revoke: IamClient.revoke,
    verifyIdToken: IamClient.verifyIdToken,
  }

  IamClient.refresh = async (refreshToken) => {
    calls.refresh.push(refreshToken)
    // Yield so concurrent requests really overlap.
    await new Promise((resolve) => setTimeout(resolve, 20))
    if (state.outcome === 'invalid_grant') throw new IamGrantRevoked('revoked')
    if (state.outcome === 'unreachable') throw new IamError('unreachable')
    const n = calls.refresh.length
    return { idToken: `id-token-${n}`, refreshToken: `rt-rotated-${n}` }
  }
  IamClient.revoke = async (refreshToken) => {
    calls.revoke.push(refreshToken)
  }
  IamClient.verifyIdToken = async (idToken, nonce) => {
    if (nonce !== null) throw new Error('refresh must verify without a nonce')
    calls.verify.push(idToken)
    return state.identity()
  }

  const restore = () => {
    Object.assign(IamClient, original)
  }
  return { calls, state, restore }
}

/** A grant for `user` last checked `ageSeconds` ago; returns its id. */
async function makeGrant(user: User, { ageSeconds = 0, refreshToken = 'rt-original' } = {}) {
  const id = randomUUID()
  await IamGrantFactory.merge({
    id,
    userId: user.id,
    refreshTokenEncrypted: IamGrant.seal(refreshToken),
    checkedAt: DateTime.now().minus({ seconds: ageSeconds }),
  }).create()
  return id
}

const grantRow = (id: string) => db.from('iam_grant').where('id', id).first()

const as = (request: ApiRequest, user: User, grantId: string) =>
  request.loginAs(user).withSession({ [GRANT_KEY]: grantId })

const dashboard = (client: ApiClient, user: User, grantId: string) =>
  as(client.get('/dashboard').redirects(0), user, grantId)

test.group('IAM re-check', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a freshly checked grant does not call IAM', async ({ client, assert, cleanup }) => {
    const user = await UserFactory.create()
    const iam = fakeIam(user)
    cleanup(iam.restore)
    const grantId = await makeGrant(user, { ageSeconds: 10 })

    const response = await dashboard(client, user, grantId)

    response.assertStatus(200)
    assert.lengthOf(iam.calls.refresh, 0)
  })

  test('a stale grant is refreshed: token rotated, checked_at and role updated', async ({
    client,
    assert,
    cleanup,
  }) => {
    const user = await UserFactory.create()
    const iam = fakeIam(user)
    cleanup(iam.restore)
    iam.state.identity = () => ({
      sub: user.id,
      email: 'renamed@example.com',
      name: 'Renamed User',
      picture: null,
      appAccess: ['share', 'other'],
      role: 'admin',
    })
    const grantId = await makeGrant(user, { ageSeconds: 301 })
    const before = DateTime.now().minus({ seconds: 2 })

    const response = await dashboard(client, user, grantId)

    response.assertStatus(200)
    assert.deepEqual(iam.calls.refresh, ['rt-original'])
    assert.deepEqual(iam.calls.verify, ['id-token-1'])
    response.assertSession(ID_TOKEN_KEY, 'id-token-1')

    const grant = await IamGrant.findOrFail(grantId)
    assert.equal(IamGrant.open(grant.refreshTokenEncrypted), 'rt-rotated-1')
    assert.isTrue(grant.checkedAt >= before)

    const fresh = await User.findOrFail(user.id)
    assert.equal(fresh.role, 'admin')
    assert.equal(fresh.email, 'renamed@example.com')
    assert.equal(fresh.name, 'Renamed User')
  })

  test('invalid_grant signs the user out and deletes the grant', async ({
    client,
    assert,
    cleanup,
  }) => {
    const user = await UserFactory.create()
    const iam = fakeIam(user)
    cleanup(iam.restore)
    iam.state.outcome = 'invalid_grant'
    const grantId = await makeGrant(user, { ageSeconds: 301 })

    const response = await dashboard(client, user, grantId)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
    response.assertFlashMessage('error', SIGNED_OUT)
    response.assertSessionMissing(GRANT_KEY)
    assert.isNull(await grantRow(grantId))
  })

  test('an ID token without the share entitlement signs the user out', async ({
    client,
    assert,
    cleanup,
  }) => {
    const user = await UserFactory.create()
    const iam = fakeIam(user)
    cleanup(iam.restore)
    iam.state.identity = () => ({
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: null,
      appAccess: ['other'],
      role: 'employee',
    })
    const grantId = await makeGrant(user, { ageSeconds: 301 })

    const response = await dashboard(client, user, grantId)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
    assert.isNull(await grantRow(grantId))
    // The rotated token isn't kept, so it's revoked at IAM.
    assert.deepEqual(iam.calls.revoke, ['rt-rotated-1'])
  })

  test('IAM unreachable fails closed', async ({ client, assert, cleanup }) => {
    const user = await UserFactory.create()
    const iam = fakeIam(user)
    cleanup(iam.restore)
    iam.state.outcome = 'unreachable'
    const grantId = await makeGrant(user, { ageSeconds: 301 })

    const response = await dashboard(client, user, grantId)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
    assert.isNull(await grantRow(grantId))
  })

  test('two concurrent requests with a stale grant refresh exactly once', async ({
    client,
    assert,
    cleanup,
  }) => {
    const user = await UserFactory.create()
    const iam = fakeIam(user)
    cleanup(iam.restore)
    const grantId = await makeGrant(user, { ageSeconds: 301 })

    const responses = await Promise.all([
      dashboard(client, user, grantId),
      dashboard(client, user, grantId),
    ])

    for (const response of responses) response.assertStatus(200)
    assert.deepEqual(iam.calls.refresh, ['rt-original'])
    const grant = await IamGrant.findOrFail(grantId)
    assert.equal(IamGrant.open(grant.refreshTokenEncrypted), 'rt-rotated-1')
  })

  test('a session without iam_grant_id is signed out', async ({ client, assert, cleanup }) => {
    const user = await UserFactory.create()
    const iam = fakeIam(user)
    cleanup(iam.restore)

    const response = await client.get('/dashboard').redirects(0).loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
    response.assertFlashMessage('error', SIGNED_OUT)
    assert.lengthOf(iam.calls.refresh, 0)
  })

  test("another user's grant id is rejected", async ({ client, assert, cleanup }) => {
    const [user, other] = await UserFactory.createMany(2)
    const iam = fakeIam(user)
    cleanup(iam.restore)
    const othersGrant = await makeGrant(other)

    const response = await dashboard(client, user, othersGrant)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
    assert.lengthOf(iam.calls.refresh, 0)
  })

  test('JSON requests get 401 session_expired', async ({ client, assert, cleanup }) => {
    const user = await UserFactory.create()
    const iam = fakeIam(user)
    cleanup(iam.restore)
    iam.state.outcome = 'invalid_grant'
    const grantId = await makeGrant(user, { ageSeconds: 301 })

    const response = await as(
      client.post('/transfers').accept('json').json({}).withCsrfToken(),
      user,
      grantId
    )

    response.assertStatus(401)
    response.assertBody({ error: 'session_expired' })
    assert.isNull(await grantRow(grantId))
  })

  test('Inertia requests are sent to /login with a location visit', async ({ client, cleanup }) => {
    const user = await UserFactory.create()
    const iam = fakeIam(user)
    cleanup(iam.restore)
    iam.state.outcome = 'invalid_grant'
    const grantId = await makeGrant(user, { ageSeconds: 301 })

    const response = await as(client.get('/dashboard').withInertia(), user, grantId)

    response.assertStatus(409)
    response.assertHeader('x-inertia-location', '/login')
  })
})

test.group('IAM re-check / logout', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('logout revokes the stored refresh token and deletes the grant', async ({
    client,
    assert,
    cleanup,
  }) => {
    const user = await UserFactory.create()
    const iam = fakeIam(user)
    cleanup(iam.restore)
    const grantId = await makeGrant(user, { refreshToken: 'rt-to-revoke' })

    const response = await as(client.post('/logout').withInertia().withCsrfToken(), user, grantId)

    response.assertStatus(409)
    assert.include(response.header('x-inertia-location'), '/oauth/logout')
    assert.deepEqual(iam.calls.revoke, ['rt-to-revoke'])
    assert.isNull(await grantRow(grantId))
    response.assertSessionMissing(GRANT_KEY)
  })

  test('a failing revoke still logs the user out', async ({ client, assert, cleanup }) => {
    const user = await UserFactory.create()
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed')
    }
    cleanup(() => {
      globalThis.fetch = originalFetch
    })

    const response = await signIn(client.post('/logout').withInertia().withCsrfToken(), user)

    response.assertStatus(409)
    assert.include(response.header('x-inertia-location'), '/oauth/logout')
    response.assertSessionMissing(GRANT_KEY)
    const [{ total }] = await db.from('iam_grant').where('user_id', user.id).count('* as total')
    assert.equal(Number(total), 0)
  })
})
