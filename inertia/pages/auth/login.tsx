import AuthLayout from '~/layouts/auth'

/**
 * Share has no local passwords; identities come from IAM. The button is a
 * plain link: the redirect leaves the app, so it must not be an Inertia visit.
 */
export default function Login() {
  return (
    <>
      <h1 className="auth__title">Welcome back</h1>
      <p className="auth__sub">Share uses your Digital Covet IAM account.</p>

      <div className="auth__form">
        <a href="/auth/iam/redirect" className="btn btn--primary btn--block">
          Sign in with IAM
        </a>
      </div>
    </>
  )
}

Login.layout = [AuthLayout]
