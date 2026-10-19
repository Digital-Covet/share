import type { HttpContext } from '@adonisjs/core/http'
import IamClient from '#services/iam_client'
import { ID_TOKEN_KEY } from '#controllers/iam_controller'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  /** Sign out of Share, then end the IAM session too (RP-initiated logout). */
  async destroy({ auth, session, inertia }: HttpContext) {
    const idToken = (session.get(ID_TOKEN_KEY) as string | undefined) ?? null
    await auth.use('web').logout()
    session.forget(ID_TOKEN_KEY)
    // An external redirect from an Inertia request has to go through location().
    return inertia.location(IamClient.logoutUrl(idToken))
  }
}
