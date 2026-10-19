import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'
import IamGrant from '#models/iam_grant'
import type User from '#models/user'
import IamClient, { APP_SLUG, IamError, IamGrantRevoked } from '#services/iam_client'
import { GRANT_KEY, ID_TOKEN_KEY } from '#controllers/iam_controller'
import env from '#start/env'

const LOGIN_PATH = '/login'
const SIGNED_OUT_MESSAGE = 'Your access to Share has changed. Please sign in again.'

type FailReason =
  'no_grant' | 'grant_revoked' | 'no_entitlement' | 'invalid_id_token' | 'iam_unreachable'

type Recheck = { ok: true; idToken: string | null } | { ok: false; reason: FailReason }

/** `outcome` of the `iam.recheck` log event, a fixed set for metrics. */
const OUTCOMES: Record<FailReason, 'revoked' | 'not_entitled' | 'iam_unreachable'> = {
  no_grant: 'revoked',
  grant_revoked: 'revoked',
  invalid_id_token: 'revoked',
  no_entitlement: 'not_entitled',
  iam_unreachable: 'iam_unreachable',
}

const recheckSeconds = () => env.get('IAM_RECHECK_SECONDS') ?? 300
const isFresh = (checkedAt: DateTime) =>
  DateTime.now().diff(checkedAt).as('seconds') < recheckSeconds()

/**
 * Re-validates the signed-in user against IAM every `IAM_RECHECK_SECONDS`
 * with the session's refresh token, mirroring the fresh role and profile.
 * Anything short of a confirmed `share` entitlement signs the user out
 * (fail closed). Runs after `auth`.
 *
 * IAM rotates refresh tokens and revokes the grant when one is replayed, so
 * the refresh runs while holding a `FOR UPDATE SKIP LOCKED` lock on the
 * `iam_grant` row: a concurrent request finds the row locked and goes on
 * without refreshing.
 */
export default class IamRecheckMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail() as User
    const grantId = ctx.session.get(GRANT_KEY) as string | undefined
    const grant = grantId ? await IamGrant.find(grantId) : null
    if (!grant || grant.userId !== user.id) return this.signOut(ctx, grantId, 'no_grant')

    if (isFresh(grant.checkedAt)) return next()

    const result = await this.recheck(user, grant.id)
    if (!result.ok) return this.signOut(ctx, grant.id, result.reason)
    if (result.idToken) {
      ctx.session.put(ID_TOKEN_KEY, result.idToken)
      ctx.logger.info({ event: 'iam.recheck', outcome: 'ok', userId: user.id }, 'iam.recheck')
    }
    return next()
  }

  /**
   * Refresh the grant under a row lock and apply the new ID token. `idToken`
   * is `null` when nothing was refreshed (row locked by a concurrent request,
   * or it refreshed just before us).
   */
  private recheck(user: User, grantId: string): Promise<Recheck> {
    return db.transaction(async (trx): Promise<Recheck> => {
      // SQLite (tests) has no row locks and knex rejects SKIP LOCKED there.
      const grant = await IamGrant.query({ client: trx })
        .where('id', grantId)
        .if(trx.dialect.name === 'postgres', (query) => query.forUpdate().skipLocked())
        .first()
      if (!grant || isFresh(grant.checkedAt)) return { ok: true, idToken: null }

      const refreshToken = IamGrant.open(grant.refreshTokenEncrypted)
      if (!refreshToken) return { ok: false, reason: 'grant_revoked' }

      let tokens
      try {
        tokens = await IamClient.refresh(refreshToken)
      } catch (err) {
        if (err instanceof IamGrantRevoked) return { ok: false, reason: 'grant_revoked' }
        if (err instanceof IamError) return { ok: false, reason: 'iam_unreachable' }
        throw err
      }

      let identity
      try {
        identity = await IamClient.verifyIdToken(tokens.idToken, null)
      } catch (err) {
        if (!(err instanceof IamError) && !(err instanceof TypeError)) throw err
        await IamClient.revoke(tokens.refreshToken)
        return { ok: false, reason: 'invalid_id_token' }
      }
      if (identity.sub !== user.id) {
        await IamClient.revoke(tokens.refreshToken)
        return { ok: false, reason: 'invalid_id_token' }
      }
      if (!identity.appAccess.includes(APP_SLUG)) {
        await IamClient.revoke(tokens.refreshToken)
        return { ok: false, reason: 'no_entitlement' }
      }

      await user
        .useTransaction(trx)
        .merge({
          email: identity.email,
          name: identity.name,
          image: identity.picture,
          role: identity.role,
        })
        .save()
      grant.merge({
        refreshTokenEncrypted: IamGrant.seal(tokens.refreshToken),
        checkedAt: DateTime.now(),
      })
      await grant.save()

      return { ok: true, idToken: tokens.idToken }
    })
  }

  /** Drop the grant, end the session and send the user to sign in again. */
  private async signOut(ctx: HttpContext, grantId: string | undefined, reason: FailReason) {
    const { auth, session, request, response, inertia, logger } = ctx
    const log = { event: 'iam.recheck', outcome: OUTCOMES[reason], reason, userId: auth.user?.id }
    if (reason === 'iam_unreachable') logger.warn(log, 'iam.recheck')
    else logger.info(log, 'iam.recheck')

    if (grantId) await IamGrant.query().where('id', grantId).delete()
    await auth.use('web').logout()
    session.forget(ID_TOKEN_KEY)
    session.forget(GRANT_KEY)
    session.flash('error', SIGNED_OUT_MESSAGE)

    if (request.header('x-inertia')) return inertia.location(LOGIN_PATH)
    if (request.accepts(['html', 'json']) === 'json') {
      return response.unauthorized({ error: 'session_expired' })
    }
    return response.redirect(LOGIN_PATH)
  }
}
