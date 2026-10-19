import Logo from '~/components/logo'
import { type ReactNode } from 'react'
import DispatchLabel from '~/components/dispatch_label'
import FlashToasts from '~/components/flash_toasts'
import ThemeToggle from '~/components/theme_toggle'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="auth">
        <div className="auth__form-col">
          <Logo size={28} />
          <div className="auth__form-wrap">{children}</div>
          <p className="label-mono text-faint">Digital Covet · Internal</p>
        </div>

        <aside className="auth__aside">
          <div className="auth__aside-top">
            <ThemeToggle />
          </div>

          <div className="auth__aside-body">
            <DispatchLabel />
            <p className="auth__quote">
              Send files to anyone at Digital Covet. Every transfer is addressed, tracked and
              expires on schedule.
            </p>
          </div>
        </aside>
      </div>
      <FlashToasts />
    </>
  )
}
