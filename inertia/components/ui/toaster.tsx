import { type ReactNode } from 'react'
import { Toast } from '@base-ui/react/toast'
import { CircleAlert, CircleCheck, X } from 'lucide-react'

/**
 * One app-wide toast queue. `toast.*` works anywhere (event handlers,
 * plain functions) as long as a <Toaster /> is mounted, which every layout
 * does through FlashToasts.
 */
const manager = Toast.createToastManager()

type ToastOptions = { id?: string }

export const toast = {
  success: (title: ReactNode, opts: ToastOptions = {}) =>
    manager.add({ ...opts, title, type: 'success' }),
  error: (title: ReactNode, opts: ToastOptions = {}) =>
    manager.add({ ...opts, title, type: 'error', priority: 'high' }),
  dismiss: (id?: string) => manager.close(id),
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={manager} timeout={4000}>
      <Toast.Portal>
        <Toast.Viewport className="toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((t) => (
    <Toast.Root key={t.id} toast={t} swipeDirection={['up', 'left', 'right']} className="toast">
      <Toast.Content className="toast__content">
        <span className="toast__icon" aria-hidden="true">
          {t.type === 'error' ? (
            <CircleAlert size={18} strokeWidth={1.8} />
          ) : (
            <CircleCheck size={18} strokeWidth={1.8} />
          )}
        </span>
        <Toast.Title className="toast__title" />
        <Toast.Close className="toast__close" aria-label="Dismiss">
          <X size={14} />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ))
}
