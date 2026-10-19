import { Button as BaseButton } from '@base-ui/react/button'

type ButtonStyle = {
  variant?: 'primary' | 'secondary'
  size?: 'md' | 'sm'
  block?: boolean
}

/**
 * Class names for the button look. Use it on elements that must not be a
 * Base UI Button, such as links (`<a>`, Inertia `<Link>`), so links and
 * buttons stay visually identical.
 */
export function buttonClass({ variant = 'primary', size = 'md', block = false }: ButtonStyle = {}) {
  return ['btn', `btn--${variant}`, size === 'sm' && 'btn--sm', block && 'btn--block']
    .filter(Boolean)
    .join(' ')
}

export function Button({
  variant,
  size,
  block,
  className,
  ...props
}: BaseButton.Props & ButtonStyle & { className?: string }) {
  const base = buttonClass({ variant, size, block })
  return <BaseButton {...props} className={className ? `${base} ${className}` : base} />
}
