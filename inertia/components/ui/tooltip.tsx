import { type ReactElement } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'

/**
 * A short hint shown on hover or focus. `children` becomes the trigger via
 * Base UI's `render` prop, so it must forward its ref and spread props (any
 * DOM element or Base UI part does).
 */
export function Tip({
  label,
  side = 'bottom',
  children,
}: {
  label: string
  side?: Tooltip.Positioner.Props['side']
  children: ReactElement
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={400} render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={6} className="z-50">
          <Tooltip.Popup className="origin-[var(--transform-origin)] rounded-[4px] bg-ink px-2 py-1 font-mono text-[11px] leading-4 text-[var(--on-ink)] shadow-md transition-[transform,opacity] duration-100 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-95 data-starting-style:opacity-0">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
