import { useMemo, useRef, useState, useTransition } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { Check, X } from 'lucide-react'
import { urlFor } from '~/client'

export type Recipient = { id: string; name: string | null; email: string; initials: string }

const label = (user: Recipient) => user.name || user.email

async function searchUsers(q: string, signal: AbortSignal): Promise<Recipient[]> {
  const response = await fetch(`${urlFor('users.search')}?q=${encodeURIComponent(q)}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`Search failed (HTTP ${response.status})`)
  return response.json()
}

/**
 * Multi-select colleague search over `GET /users/search`. Only people who
 * have signed in to Share at least once can be found (local user mirror).
 */
export default function RecipientPicker({
  id,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id: string
  value: Recipient[]
  onChange: (next: Recipient[]) => void
  disabled?: boolean
  invalid?: boolean
}) {
  const [results, setResults] = useState<Recipient[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const abortRef = useRef<AbortController | null>(null)

  // Keep selected people in `items` so their chips stay resolvable while results change.
  const items = useMemo(
    () => [...results, ...value.filter((v) => !results.some((r) => r.id === v.id))],
    [results, value]
  )

  const trimmed = query.trim()
  let status: string | null = null
  if (isPending) status = 'Searching…'
  else if (error) status = error
  else if (trimmed.length < 2) status = 'Type at least 2 characters of a name or email'
  else if (results.length === 0) status = `No colleagues match "${trimmed}"`

  return (
    <Combobox.Root
      items={items}
      multiple
      filter={null}
      disabled={disabled}
      value={value}
      itemToStringLabel={label}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      onValueChange={(next) => {
        onChange(next)
        setQuery('')
        setResults([])
      }}
      onInputValueChange={(next, { reason }) => {
        setQuery(next)
        abortRef.current?.abort()
        if (reason === 'item-press' || next.trim().length < 2) {
          setResults([])
          setError(null)
          return
        }

        const controller = new AbortController()
        abortRef.current = controller
        startTransition(async () => {
          try {
            const found = await searchUsers(next.trim(), controller.signal)
            if (controller.signal.aborted) return
            startTransition(() => {
              setResults(found)
              setError(null)
            })
          } catch {
            if (controller.signal.aborted) return
            startTransition(() => setError('Could not search colleagues. Try again.'))
          }
        })
      }}
    >
      <Combobox.InputGroup
        className={`flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-md border bg-white px-2 py-1 focus-within:outline-2 focus-within:outline-neutral-900 dark:bg-neutral-950 dark:focus-within:outline-white ${invalid ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-700'}`}
      >
        <Combobox.Chips className="flex w-full flex-wrap items-center gap-1">
          {value.map((user) => (
            <Combobox.Chip
              key={user.id}
              className="flex items-center gap-1 rounded bg-neutral-100 py-0.5 pr-0.5 pl-1.5 text-sm outline-none focus-within:bg-neutral-900 focus-within:text-white dark:bg-neutral-800 dark:focus-within:bg-white dark:focus-within:text-neutral-900"
              aria-label={label(user)}
              title={user.email}
            >
              {label(user)}
              <Combobox.ChipRemove
                className="flex size-4 items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
                aria-label={`Remove ${label(user)}`}
              >
                <X size={12} />
              </Combobox.ChipRemove>
            </Combobox.Chip>
          ))}
          <Combobox.Input
            id={id}
            placeholder={value.length > 0 ? '' : 'Search colleagues by name or email'}
            aria-invalid={invalid || undefined}
            className="h-7 min-w-24 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-neutral-500"
          />
        </Combobox.Chips>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="z-50 outline-none" sideOffset={4}>
          <Combobox.Popup
            className="w-[var(--anchor-width)] max-w-[var(--available-width)] rounded-md border border-neutral-200 bg-white text-neutral-900 shadow-lg dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
            aria-busy={isPending || undefined}
          >
            <div className="max-h-[min(var(--available-height),20rem)] overflow-y-auto py-1">
              <Combobox.Status>
                {status ? (
                  <div className="px-3 py-1.5 text-sm text-neutral-500">{status}</div>
                ) : null}
              </Combobox.Status>
              <Combobox.List>
                {(user: Recipient) => (
                  <Combobox.Item
                    key={user.id}
                    value={user}
                    className="grid cursor-default grid-cols-[1rem_1.75rem_1fr] items-center gap-2 px-3 py-1.5 text-sm outline-none select-none data-highlighted:bg-neutral-100 dark:data-highlighted:bg-neutral-800"
                  >
                    <Combobox.ItemIndicator className="col-start-1">
                      <Check size={14} />
                    </Combobox.ItemIndicator>
                    <span className="col-start-2 flex size-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium dark:bg-neutral-700">
                      {user.initials}
                    </span>
                    <span className="col-start-3 flex min-w-0 flex-col">
                      <span className="truncate font-medium">{label(user)}</span>
                      {user.name && (
                        <span className="truncate text-xs text-neutral-500">{user.email}</span>
                      )}
                    </span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
