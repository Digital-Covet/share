import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import IamClient, { IamError, IamGrantRevoked, parseRole } from '#services/iam_client'

test.group('IamClient / role claim', () => {
  test('keeps any string role as-is', ({ assert }) => {
    assert.equal(parseRole('admin'), 'admin')
    assert.equal(parseRole('superadmin'), 'superadmin')
    assert.equal(parseRole('employee'), 'employee')
    assert.equal(parseRole('team-lead'), 'team-lead')
  })

  test('falls back to employee when missing or not a string', ({ assert }) => {
    assert.equal(parseRole(undefined), 'employee')
    assert.equal(parseRole(null), 'employee')
    assert.equal(parseRole(''), 'employee')
    assert.equal(parseRole(42), 'employee')
    assert.equal(parseRole(['admin']), 'employee')
  })

  test('authorizeUrl requests the roles and offline_access scopes', ({ assert }) => {
    const url = new URL(IamClient.authorizeUrl(IamClient.newAttempt()))
    const scopes = url.searchParams.get('scope')!.split(' ')

    assert.includeMembers(scopes, ['openid', 'profile', 'entitlements', 'roles', 'offline_access'])
  })
})

type FetchCall = { url: string; init: RequestInit | undefined }

/** Swap `fetch` for one test; `handler` answers every request. */
function stubFetch(
  cleanup: (fn: () => void) => void,
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>
) {
  const calls: FetchCall[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    return handler(url, init)
  }) as typeof fetch
  cleanup(() => {
    globalThis.fetch = original
  })
  return calls
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test.group('IamClient / tokens', () => {
  test('exchangeCode returns the ID token and the refresh token', async ({ assert, cleanup }) => {
    stubFetch(cleanup, () => json({ id_token: 'id', refresh_token: 'rt' }))

    assert.deepEqual(await IamClient.exchangeCode('code', 'verifier'), {
      idToken: 'id',
      refreshToken: 'rt',
    })
  })

  test('exchangeCode reports a missing refresh token as null', async ({ assert, cleanup }) => {
    stubFetch(cleanup, () => json({ id_token: 'id' }))

    const tokens = await IamClient.exchangeCode('code', 'verifier')
    assert.isNull(tokens.refreshToken)
  })

  test('refresh posts a refresh_token grant to the token endpoint', async ({ assert, cleanup }) => {
    const calls = stubFetch(cleanup, () => json({ id_token: 'id-2', refresh_token: 'rt-2' }))

    const tokens = await IamClient.refresh('rt-1')

    assert.deepEqual(tokens, { idToken: 'id-2', refreshToken: 'rt-2' })
    assert.lengthOf(calls, 1)
    assert.equal(calls[0].url, 'http://localhost:3999/oauth/token')
    assert.equal(calls[0].init?.method, 'POST')
    const headers = calls[0].init?.headers as Record<string, string>
    assert.equal(headers['Content-Type'], 'application/x-www-form-urlencoded')
    const body = new URLSearchParams(String(calls[0].init?.body))
    assert.equal(body.get('grant_type'), 'refresh_token')
    assert.equal(body.get('refresh_token'), 'rt-1')
    assert.equal(body.get('client_id'), 'test')
  })

  test('refresh throws IamGrantRevoked on invalid_grant', async ({ assert, cleanup }) => {
    stubFetch(cleanup, () => json({ error: 'invalid_grant' }, 400))

    await assert.rejects(() => IamClient.refresh('rt'), IamGrantRevoked)
  })

  test('refresh throws a plain IamError on 5xx, network errors and incomplete bodies', async ({
    assert,
    cleanup,
  }) => {
    const responses: Array<() => Response> = [
      () => json({ error: 'server_error' }, 503),
      () => {
        throw new TypeError('fetch failed')
      },
      () => json({ id_token: 'id' }),
    ]
    let i = 0
    stubFetch(cleanup, () => responses[i++]())

    for (let n = 0; n < responses.length; n++) {
      const err = await IamClient.refresh('rt').catch((e) => e)
      assert.instanceOf(err, IamError)
      assert.notInstanceOf(err, IamGrantRevoked)
    }
  })

  test('revoke posts the token to /oauth/revoke and never throws', async ({ assert, cleanup }) => {
    let fail = false
    const calls = stubFetch(cleanup, () => {
      if (fail) throw new TypeError('fetch failed')
      return new Response(null, { status: 200 })
    })

    await IamClient.revoke('rt-1')
    fail = true
    await IamClient.revoke('rt-2')

    assert.equal(calls[0].url, 'http://localhost:3999/oauth/revoke')
    const body = new URLSearchParams(String(calls[0].init?.body))
    assert.equal(body.get('token'), 'rt-1')
    assert.equal(body.get('token_type_hint'), 'refresh_token')
    assert.equal(body.get('client_id'), 'test')
  })
})

test.group('IamClient / verifyIdToken nonce', () => {
  /** An RS256 ID token for the test client, signed with a fresh key served as JWKS. */
  function signedToken(cleanup: (fn: () => void) => void, extraClaims: Record<string, unknown>) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const kid = randomUUID()
    stubFetch(cleanup, () =>
      json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }] })
    )
    const now = Math.floor(Date.now() / 1000)
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const header = encode({ alg: 'RS256', kid })
    const payload = encode({
      iss: 'http://localhost:3999',
      aud: 'test',
      sub: randomUUID(),
      email: 'user@example.com',
      app_access: ['share'],
      role: 'admin',
      iat: now,
      exp: now + 300,
      ...extraClaims,
    })
    const signature = createSign('RSA-SHA256')
      .update(`${header}.${payload}`)
      .sign(privateKey)
      .toString('base64url')
    return `${header}.${payload}.${signature}`
  }

  test('a null nonce skips the nonce check (refreshed tokens)', async ({ assert, cleanup }) => {
    const token = signedToken(cleanup, {})

    const identity = await IamClient.verifyIdToken(token, null)

    assert.equal(identity.role, 'admin')
    assert.deepEqual(identity.appAccess, ['share'])
  })

  test('a given nonce must still match', async ({ assert, cleanup }) => {
    const token = signedToken(cleanup, { nonce: 'expected' })

    await assert.doesNotReject(() => IamClient.verifyIdToken(token, 'expected'))
    await assert.rejects(() => IamClient.verifyIdToken(token, 'other'), 'ID token nonce mismatch.')
  })

  test('a token without a nonce fails when one is expected', async ({ assert, cleanup }) => {
    const token = signedToken(cleanup, {})

    await assert.rejects(() => IamClient.verifyIdToken(token, 'expected'), IamError)
  })
})
