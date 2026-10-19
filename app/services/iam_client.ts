import { createHash, createPublicKey, createVerify, randomBytes, type KeyObject } from 'node:crypto'
import env from '#start/env'

/** Slug of this app in IAM; users need it in `app_access` to sign in. */
export const APP_SLUG = 'share'

const SCOPES = ['openid', 'profile', 'entitlements']
const JWKS_TTL_MS = 5 * 60_000
const CLOCK_SKEW_S = 60

export class IamError extends Error {}

export type IamIdentity = {
  sub: string
  email: string
  name: string | null
  picture: string | null
  appAccess: string[]
}

const issuer = () => env.get('IAM_ISSUER').replace(/\/$/, '')
const random = () => randomBytes(32).toString('base64url')

let jwksCache: { keys: Map<string, KeyObject>; fetchedAt: number } | null = null

async function fetchJwks(): Promise<Map<string, KeyObject>> {
  const res = await fetch(`${issuer()}/.well-known/jwks.json`)
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

  /** Redeem the authorization code; returns the raw ID token. */
  static async exchangeCode(code: string, verifier: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.get('IAM_REDIRECT_URI'),
      code_verifier: verifier,
      client_id: env.get('IAM_CLIENT_ID'),
    })
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    }
    const secret = env.get('IAM_CLIENT_SECRET')
    if (secret) {
      const id = encodeURIComponent(env.get('IAM_CLIENT_ID'))
      headers.Authorization = `Basic ${Buffer.from(`${id}:${encodeURIComponent(secret)}`).toString('base64')}`
    }

    const res = await fetch(`${issuer()}/oauth/token`, { method: 'POST', headers, body })
    const json = (await res.json().catch(() => ({}))) as Record<string, any>
    if (!res.ok) {
      throw new IamError(`Token request failed: ${json.error ?? res.status}.`)
    }
    if (typeof json.id_token !== 'string') throw new IamError('Token response had no ID token.')
    return json.id_token
  }

  /** Verify signature (RS256 via JWKS), iss, aud, exp and nonce; return the identity. */
  static async verifyIdToken(idToken: string, nonce: string): Promise<IamIdentity> {
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
    if (claims.nonce !== nonce) throw new IamError('ID token nonce mismatch.')
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string')
      throw new IamError('ID token is missing sub or email.')

    return {
      sub: claims.sub,
      email: claims.email,
      name: typeof claims.name === 'string' ? claims.name : null,
      picture: typeof claims.picture === 'string' ? claims.picture : null,
      appAccess: Array.isArray(claims.app_access) ? claims.app_access : [],
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
