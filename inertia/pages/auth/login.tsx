import { Head } from '@inertiajs/react'
import { ArrowRight, KeyRound } from 'lucide-react'
import AuthLayout from '~/layouts/auth'
import { buttonClass } from '~/components/ui/button'

/**
 * Share has no local passwords; identities come from IAM. The button is a
 * plain link: the redirect leaves the app, so it must not be an Inertia visit.
 */
export default function Login() {
  return (
    <>
      <Head title="Sign in" />
      <p className="auth__eyebrow label-mono">Sign in</p>
      <h1 className="auth__title">Welcome back</h1>
      <p className="auth__sub">Share uses your Digital Covet IAM account.</p>

      <div className="auth__form">
        <a href="/auth/iam/redirect" className={buttonClass({ variant: 'primary', block: true })}>
          <KeyRound size={16} aria-hidden="true" />
          Sign in with IAM
          <ArrowRight size={16} aria-hidden="true" className="btn__arrow" />
        </a>
        <p className="auth__caption label-mono">Secured by Digital Covet IAM · OIDC + PKCE</p>
      </div>
    </>
  )
}

Login.layout = [AuthLayout]
