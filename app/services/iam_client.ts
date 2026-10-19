import { createHash, createPublicKey, createVerify, randomBytes, type KeyObject } from 'node:crypto'
import env from '#start/env'

/** Slug of this app in IAM; users need it in `app_access` to sign in. */
export const APP_SLUG = 'share'

/** `offline_access` gets a refresh token, used to re-check access (Phase 9). */
const SCOPES = ['openid', 'profile', 'entitlements', 'roles', 'offline_access']
/** Role assumed when IAM sends no usable `role` claim. */
export const DEFAULT_ROLE = 'employee'
const JWKS_TTL_MS = 5 * 60_000
const CLOCK_SKEW_S = 60

export class IamError extends Error {}
/** IAM answered `invalid_grant`: the user, their entitlement or the grant is gone. */
export class IamGrantRevoked extends IamError {}

export type IamIdentity = {
  sub: string
  email: string
  name: string | null
  picture: string | null
  appAccess: string[]
  /** IAM role name (`superadmin`, `admin`, `employee` or a custom one). */
  role: string
}

/** The `role` claim (sent with the `roles` scope); missing or non-string → `employee`. */
export function parseRole(claim: unknown): string {
  return typeof claim === 'string' && claim.trim() !== '' ? claim : DEFAULT_ROLE
}

const issuer = () => env.get('IAM_ISSUER').replace(/\/$/, '')
const random = () => randomBytes(32).toString('base64url')

/**
 * Fetch from IAM without following redirects: `fetch` would turn a redirected
 * POST into a bodiless GET, which IAM answers with a bare 404. A redirect
 * means `IAM_ISSUER` isn't IAM's canonical URL (http vs https, www, ...).
 */
async function iamFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${issuer()}${path}`, { ...init, redirect: 'manual' })
  if (res.status >= 300 && res.status < 400) {
    throw new IamError(
      `IAM redirected ${path} to ${res.headers.get('location')}; set IAM_ISSUER to IAM's canonical URL.`
    )
  }
  return res
}

/**
 * Form POST to an IAM endpoint with client authentication: HTTP Basic for a
 * confidential client, `client_id` in the body for a public one (it's sent
 * either way, as IAM accepts both).
 */
async function clientPost(path: string, params: Record<string, string>) {
  const body = new URLSearchParams({ ...params, client_id: env.get('IAM_CLIENT_ID') })
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  }
  const secret = env.get('IAM_CLIENT_SECRET')
  if (secret) {
    const id = encodeURIComponent(env.get('IAM_CLIENT_ID'))
    headers.Authorization = `Basic ${Buffer.from(`${id}:${encodeURIComponent(secret)}`).toString('base64')}`
  }

  const res = await iamFetch(path, { method: 'POST', headers, body })
  const json = (await res.json().catch(() => ({}))) as Record<string, any>
  return { res, json }
}

let jwksCache: { keys: Map<string, KeyObject>; fetchedAt: number } | null = null

async function fetchJwks(): Promise<Map<string, KeyObject>> {
  const res = await iamFetch('/.well-known/jwks.json')
  if (!res.ok) throw new IamError(`JWKS request failed (${res.status}).`)
  const body = (await res.json()) as { keys?: Array<Record<string, any>> }
  const keys = new Map<string, KeyObject>()
  for (const jwk of body.keys ?? []) {
    if (jwk.kty !== 'RSA' || (jwk.alg && jwk.alg !== 'RS256') || (jwk.use && jwk.use !== 'sig'))
      continue
    keys.set(jwk.kid ?? '', createPublicKey({ key: jwk as any, format: 'jwk' }))
  }
  jwksCache = { keys, fetchedAt: Date.now() }
  return keys
}

/** Signing key by `kid`, refetching once when the key is unknown (rotation). */
async function signingKey(kid: string): Promise<KeyObject> {
  let keys =
    jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS ? jwksCache.keys : await fetchJwks()
  if (!keys.has(kid)) keys = await fetchJwks()
  const key = keys.get(kid)
  if (!key) throw new IamError('ID token was signed with an unknown key.')
  return key
}

/**
 * OAuth 2.0 / OIDC relying party for IAM: authorization-code flow with PKCE,
 * ID tokens verified locally against IAM's JWKS.
 */
export default class IamClient {
  /** Fresh state, nonce and PKCE verifier for one sign-in attempt. */
  static newAttempt() {
    return { state: random(), nonce: random(), verifier: random() }
  }

  static authorizeUrl(attempt: { state: string; nonce: string; verifier: string }) {
    const url = new URL(`${issuer()}/oauth/authorize`)
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: env.get('IAM_CLIENT_ID'),
      redirect_uri: env.get('IAM_REDIRECT_URI'),
      scope: SCOPES.join(' '),
      state: attempt.state,
      nonce: attempt.nonce,
      code_challenge: createHash('sha256').update(attempt.verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString()
    return url.toString()
  }

  /**
   * Redeem the authorization code. `refreshToken` is `null` when IAM didn't
   * grant `offline_access`.
   */
  static async exchangeCode(
    code: string,
    verifier: string
  ): Promise<{ idToken: string; refreshToken: string | null }> {
    const { res, json } = await clientPost('/oauth/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.get('IAM_REDIRECT_URI'),
      code_verifier: verifier,
    })
    if (!res.ok) {
      throw new IamError(`Token request failed: ${json.error ?? res.status}.`)
    }
    if (typeof json.id_token !== 'string') throw new IamError('Token response had no ID token.')
    return {
      idToken: json.id_token,
      refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    }
  }

  /**
   * Redeem a refresh token for a fresh ID token and the rotated refresh
   * token. The old token is dead afterwards; replaying it revokes the grant.
   * Throws `IamGrantRevoked` on `invalid_grant`, `IamError` on anything else
   * (including network errors).
   */
  static async refresh(refreshToken: string): Promise<{ idToken: string; refreshToken: string }> {
    let result
    try {
      result = await clientPost('/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      })
    } catch (err) {
      throw new IamError('Refresh request failed.', { cause: err })
    }
    const { res, json } = result
    if (json.error === 'invalid_grant') throw new IamGrantRevoked('IAM revoked the grant.')
    if (!res.ok) throw new IamError(`Refresh request failed: ${json.error ?? res.status}.`)
    if (typeof json.id_token !== 'string' || typeof json.refresh_token !== 'string') {
      throw new IamError('Refresh response had no ID token or refresh token.')
    }
    return { idToken: json.id_token, refreshToken: json.refresh_token }
  }

  /** End the whole grant at IAM (RFC 7009). Best-effort: never throws. */
  static async revoke(refreshToken: string): Promise<void> {
    try {
      await clientPost('/oauth/revoke', {
        token: refreshToken,
        token_type_hint: 'refresh_token',
      })
    } catch {
      // IAM unreachable: the grant stays until it expires; nothing else to do.
    }
  }

  /**
   * Verify signature (RS256 via JWKS), iss, aud, exp and nonce; return the
   * identity. Pass `nonce: null` for refreshed ID tokens, which carry none.
   */
  static async verifyIdToken(idToken: string, nonce: string | null): Promise<IamIdentity> {
    const parts = idToken.split('.')
    if (parts.length !== 3) throw new IamError('Malformed ID token.')

    let header: Record<string, any>
    let claims: Record<string, any>
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    } catch {
      throw new IamError('Malformed ID token.')
    }
    if (header.alg !== 'RS256') throw new IamError('Unexpected ID token algorithm.')

    const key = await signingKey(typeof header.kid === 'string' ? header.kid : '')
    const valid = createVerify('RSA-SHA256')
      .update(`${parts[0]}.${parts[1]}`)
      .verify(key, Buffer.from(parts[2], 'base64url'))
    if (!valid) throw new IamError('Invalid ID token signature.')

    const now = Math.floor(Date.now() / 1000)
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (claims.iss !== issuer()) throw new IamError('ID token issuer mismatch.')
    if (!aud.includes(env.get('IAM_CLIENT_ID'))) throw new IamError('ID token audience mismatch.')
    if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < now)
      throw new IamError('ID token expired.')
    if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_S > now)
      throw new IamError('ID token issued in the future.')
    if (nonce !== null && claims.nonce !== nonce) throw new IamError('ID token nonce mismatch.')
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string')
      throw new IamError('ID token is missing sub or email.')

    return {
      sub: claims.sub,
      email: claims.email,
      name: typeof claims.name === 'string' ? claims.name : null,
      picture: typeof claims.picture === 'string' ? claims.picture : null,
      appAccess: Array.isArray(claims.app_access) ? claims.app_access : [],
      role: parseRole(claims.role),
    }
  }

  /** RP-initiated logout URL; with a hint IAM signs the user out without asking. */
  static logoutUrl(idTokenHint: string | null) {
    const url = new URL(`${issuer()}/oauth/logout`)
    const params = new URLSearchParams({ client_id: env.get('IAM_CLIENT_ID') })
    if (idTokenHint) params.set('id_token_hint', idTokenHint)
    const postLogout = env.get('IAM_POST_LOGOUT_REDIRECT_URI')
    if (postLogout) params.set('post_logout_redirect_uri', postLogout)
    url.search = params.toString()
    return url.toString()
  }
}
