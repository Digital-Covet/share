import { Avatar } from '@base-ui/react/avatar'

/**
 * A user's picture, or their initials while it loads or when there is none.
 * Decorative: always render the person's name as text next to it.
 */
export function UserAvatar({
  user,
  size = 20,
}: {
  user: { image: string | null; initials: string }
  size?: number
}) {
  return (
    <Avatar.Root
      aria-hidden="true"
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {user.image && <Avatar.Image src={user.image} alt="" className="avatar__image" />}
      <Avatar.Fallback>{user.initials}</Avatar.Fallback>
    </Avatar.Root>
  )
}
