import type { HttpContext } from '@adonisjs/core/http'
import IamGrant from '#models/iam_grant'
import IamClient from '#services/iam_client'
import { GRANT_KEY, ID_TOKEN_KEY } from '#controllers/iam_controller'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  /**
   * Sign out of Share: revoke the IAM grant behind this session (best-effort)
   * and drop its row, then end the IAM session too (RP-initiated logout).
   */
  async destroy({ auth, session, inertia }: HttpContext) {
    const idToken = (session.get(ID_TOKEN_KEY) as string | undefined) ?? null
    const grantId = session.get(GRANT_KEY) as string | undefined
    if (grantId) {
      const grant = await IamGrant.find(grantId)
      const refreshToken = grant && IamGrant.open(grant.refreshTokenEncrypted)
      if (refreshToken) await IamClient.revoke(refreshToken)
      await IamGrant.query().where('id', grantId).delete()
    }

    await auth.use('web').logout()
    session.forget(ID_TOKEN_KEY)
    session.forget(GRANT_KEY)
    // An external redirect from an Inertia request has to go through location().
    return inertia.location(IamClient.logoutUrl(idToken))
  }
}
