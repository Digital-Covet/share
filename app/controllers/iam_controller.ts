import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import IamClient, { APP_SLUG, IamError } from '#services/iam_client'

/** One sign-in attempt, kept in the session between redirect and callback. */
const ATTEMPT_KEY = 'iam_attempt'
/** ID token kept only as `id_token_hint`, so IAM logout skips its confirm page. */
export const ID_TOKEN_KEY = 'iam_id_token'

type Attempt = { state: string; nonce: string; verifier: string }

/**
 * "Sign in with IAM": OAuth 2.0 authorization-code flow with PKCE against
 * the IAM OpenID provider. Local users mirror IAM identities.
 */
export default class IamController {
  /** GET /auth/iam/redirect — start a sign-in attempt and send the user to IAM. */
  async redirect({ session, response }: HttpContext) {
    const attempt = IamClient.newAttempt()
    session.put(ATTEMPT_KEY, attempt satisfies Attempt)
    return response.redirect().withQs(false).toPath(IamClient.authorizeUrl(attempt))
  }

  /** GET /auth/iam/callback — IAM sends the user back here with a code. */
  async callback({ request, session, response, auth, logger }: HttpContext) {
    const attempt = session.pull(ATTEMPT_KEY) as Attempt | undefined
    const { code, state, error } = request.qs()

    const fail = (message: string) => {
      session.flash('error', message)
      return response.redirect().withQs(false).toRoute('session.create')
    }

    if (!attempt || typeof state !== 'string' || state !== attempt.state) {
      return fail('Your sign-in attempt expired. Please try again.')
    }
    if (error === 'access_denied') return fail('Sign-in was cancelled.')
    if (error || typeof code !== 'string') return fail('IAM could not sign you in.')

    let identity
    let idToken: string
    try {
      idToken = await IamClient.exchangeCode(code, attempt.verifier)
      identity = await IamClient.verifyIdToken(idToken, attempt.nonce)
    } catch (err) {
      if (!(err instanceof IamError) && !(err instanceof TypeError)) throw err
      logger.warn({ err }, 'IAM sign-in failed')
      return fail('IAM could not sign you in.')
    }

    if (!identity.appAccess.includes(APP_SLUG)) {
      return fail('Your IAM account does not have access to Share.')
    }

    const user = await User.updateOrCreate(
      { id: identity.sub },
      { email: identity.email, name: identity.name, image: identity.picture }
    )
    await auth.use('web').login(user)
    session.put(ID_TOKEN_KEY, idToken)

    return response.redirect().withQs(false).toRoute('dashboard')
  }
}
