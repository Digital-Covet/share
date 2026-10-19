import { randomUUID } from 'node:crypto'
import type { ApiRequest } from '@japa/api-client'
import type User from '#models/user'
import { IamGrantFactory } from '#database/factories/iam_grant_factory'
import { GRANT_KEY } from '#controllers/iam_controller'

/**
 * Send `request` as `user` with a session that passes the IAM re-check: a
 * fresh `iam_grant` row plus its id in the session. A bare `.loginAs(user)`
 * is signed out by `iam_recheck` for lacking a grant.
 *
 * Returns the response (awaiting the request), like awaiting `request` itself.
 */
export async function signIn(request: ApiRequest, user: User) {
  const grantId = randomUUID()
  await IamGrantFactory.merge({ id: grantId, userId: user.id }).create()
  return request.loginAs(user).withSession({ [GRANT_KEY]: grantId })
}
