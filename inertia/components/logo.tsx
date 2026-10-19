import { Link } from '@adonisjs/inertia/react'

/** CovetDrop wordmark: a parcel glyph with an outbound arrow, plus the name. */
export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <Link
      route="dashboard"
      aria-label="CovetDrop"
      className="inline-flex items-center gap-2 text-ink no-underline"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="7" fill="currentColor" />
        <path
          d="M9 13.5 16 10l7 3.5v7L16 24l-7-3.5v-7Z"
          stroke="var(--canvas)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M9 13.5 16 17l7-3.5M16 17v7" stroke="var(--canvas)" strokeWidth="1.6" />
        <circle cx="23.5" cy="8.5" r="2.5" fill="var(--accent)" />
      </svg>
      <span aria-hidden="true" className="text-[15px] font-semibold tracking-[-0.01em]">
        CovetDrop
      </span>
    </Link>
  )
}
