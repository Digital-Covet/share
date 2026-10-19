import { useEffect } from 'react'
import { router, usePage } from '@inertiajs/react'
import { toast, Toaster } from '~/components/ui/toaster'

export default function FlashToasts() {
  const { flash } = usePage()

  useEffect(() => {
    return router.on('start', () => toast.dismiss('flash'))
  }, [])

  useEffect(() => {
    if (flash.error) toast.error(flash.error, { id: 'flash' })
    if (flash.success) toast.success(flash.success, { id: 'flash' })
  }, [flash])

  return <Toaster />
}
