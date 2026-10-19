import { router, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Menu } from '@base-ui/react/menu'
import { ChevronDown, Inbox, LogOut, Send } from 'lucide-react'
import { urlFor } from '~/client'
import { UserAvatar } from '~/components/ui/avatar'

/**
 * The signed-in user's dropdown in the app header: who you are, shortcuts
 * to your transfers, and sign out. Renders nothing for guests.
 */
export default function AccountMenu() {
  const { user } = usePage().props
  if (!user) return null

  const name = user.name || user.email

  return (
    <Menu.Root>
      <Menu.Trigger className="account-trigger" aria-label={`Account menu for ${name}`}>
        <UserAvatar user={user} size={24} />
        <span className="account-trigger__name">{name}</span>
        <ChevronDown size={14} aria-hidden="true" className="account-trigger__chevron" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Menu.Popup className="menu">
            <Menu.Group>
              <Menu.GroupLabel className="menu__head">
                <UserAvatar user={user} size={32} />
                <span className="menu__who">
                  <span className="menu__name">{name}</span>
                  {user.name && <span className="menu__email">{user.email}</span>}
                </span>
              </Menu.GroupLabel>
            </Menu.Group>

            <Menu.Separator className="menu__sep" />

            <Menu.LinkItem
              closeOnClick
              className="menu__item"
              render={<Link route="transfers.index" qs={{ tab: 'received' }} />}
            >
              <Inbox size={15} aria-hidden="true" /> Received transfers
            </Menu.LinkItem>
            <Menu.LinkItem
              closeOnClick
              className="menu__item"
              render={<Link route="transfers.index" qs={{ tab: 'sent' }} />}
            >
              <Send size={15} aria-hidden="true" /> Sent transfers
            </Menu.LinkItem>

            <Menu.Separator className="menu__sep" />

            <Menu.Item
              className="menu__item"
              onClick={() => router.post(urlFor('session.destroy'))}
            >
              <LogOut size={15} aria-hidden="true" /> Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
