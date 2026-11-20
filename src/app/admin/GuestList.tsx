'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { manualCheckInAction, undoCheckInAction, updateTicketAction } from '../actions'
import { headline } from '@/lib/display'
import type { Ticket } from '@/lib/types'

type Filter = 'all' | 'out' | 'in' | 'noname'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'out', label: 'Not arrived' },
  { id: 'in', label: 'Arrived' },
  { id: 'noname', label: 'No name' },
]
const SHOW = 20 // ponytail: render cap; search narrows long lists. Virtualize if events grow past a few thousand tickets.

const fmt = (iso: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

export default function GuestList({ event, tickets, readOnly }: { event: string; tickets: Ticket[]; readOnly: boolean }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [status, setStatus] = useState('')

  const q = query.trim().toLowerCase()
  const matches = tickets.filter((t) => {
    if (filter === 'in' && !t.checkedInAt) return false
    if (filter === 'out' && t.checkedInAt) return false
    if (filter === 'noname' && t.name) return false
    return !q || t.ticket.includes(q) || t.name.toLowerCase().includes(q) || t.info.toLowerCase().includes(q)
  })
  const shown = matches.slice(0, SHOW)

  return (
    <section aria-labelledby="find" className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
      <h2 id="find" className="text-xl font-extrabold">
        Find a guest
      </h2>
      <label className="relative block">
        <span className="sr-only">Search by name or ticket number</span>
        <svg className="pointer-events-none absolute top-4.5 left-4 text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or ticket number"
          className="h-14 w-full rounded-xl border-2 border-line-strong bg-surface pr-4 pl-12 text-[17px] font-medium focus:border-primary focus:outline-none"
        />
      </label>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Show</legend>
        {FILTERS.map((f) => (
          <label
            key={f.id}
            className={`flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors duration-200 has-focus-visible:outline-3 has-focus-visible:outline-gold ${
              filter === f.id ? 'border-primary bg-primary text-primary-ink' : 'border-line-strong bg-surface hover:bg-soft'
            }`}
          >
            <input type="radio" name="filter" value={f.id} checked={filter === f.id} onChange={() => setFilter(f.id)} className="sr-only" />
            {f.label}
          </label>
        ))}
      </fieldset>

      {matches.length === 0 ? (
        <p className="py-6 text-muted">
          No guests match{q ? ` “${query}”` : ''}.{' '}
          <button
            className="font-semibold text-primary underline"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            Show everyone
          </button>
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((t) => (
            <Guest key={t.ticket} event={event} t={t} readOnly={readOnly} onStatus={setStatus} />
          ))}
        </ul>
      )}
      <p role="status" className="text-sm text-muted">
        {status ||
          (matches.length > SHOW
            ? `Showing the first ${SHOW} of ${matches.length}. Type a name or number to narrow it down.`
            : `${matches.length} ${matches.length === 1 ? 'guest' : 'guests'}${q ? ` match “${query}”` : ''}.`)}
      </p>
    </section>
  )
}

function Guest({ event, t, readOnly, onStatus }: { event: string; t: Ticket; readOnly: boolean; onStatus: (s: string) => void }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: t.name, info: t.info, notes: t.notes })
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const label = headline(t)

  const act = (fn: () => Promise<{ error?: string; message?: string; result?: string }>, done: string) =>
    start(async () => {
      setError('')
      try {
        const r = await fn()
        if (r.error) return setError(r.error)
        if (r.result && r.result !== 'checked_in') return setError(r.message ?? 'Not checked in')
        setEditing(false)
        onStatus(done)
        router.refresh()
      } catch {
        setError('Couldn’t save. Check the connection and try again.')
      }
    })

  const btn = 'h-11 rounded-xl px-4 text-[15px] font-semibold transition-colors duration-200 disabled:opacity-60'

  if (editing)
    return (
      <li className="flex flex-col gap-3 rounded-2xl border-2 border-primary p-4">
        <span className="text-lg font-extrabold tabular-nums">Ticket {t.ticket}</span>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['name', 'info', 'notes'] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1.5 text-sm font-bold capitalize">
              {k === 'info' ? 'Group or info' : k}
              <input
                value={draft[k]}
                autoComplete="off"
                autoFocus={k === 'name'}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                className="h-11 rounded-xl border-[1.5px] border-line-strong bg-surface px-3 text-base font-medium focus:border-primary focus:outline-none"
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={pending}
            onClick={() => act(() => updateTicketAction(event, t.ticket, draft), `Saved ${headline({ ticket: t.ticket, name: draft.name })}.`)}
            className={`${btn} bg-primary text-primary-ink hover:bg-primary-hover`}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button disabled={pending} onClick={() => setEditing(false)} className={`${btn} border border-line-strong hover:bg-soft`}>
            Cancel
          </button>
          {error && (
            <span role="alert" className="text-sm font-semibold text-bad">
              {error}
            </span>
          )}
        </div>
      </li>
    )

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line p-4">
      <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
        <span className="text-[17px] font-bold wrap-anywhere">
          {label}
          {t.name && <span className="ml-2 text-sm font-semibold text-muted tabular-nums">{t.ticket}</span>}
        </span>
        <span className={`text-sm ${t.checkedInAt ? 'font-semibold text-ok' : 'text-muted'}`}>
          {t.checkedInAt
            ? `Arrived ${fmt(t.checkedInAt)}, checked in by ${t.checkedInBy || 'someone'}${t.method === 'manual' ? ' (by hand)' : ''}`
            : `Not arrived yet${t.info ? `. ${t.info}` : ''}`}
        </span>
        {error && (
          <span role="alert" className="text-sm font-semibold text-bad">
            {error}
          </span>
        )}
      </span>
      {!readOnly && (
        <span className="flex gap-2">
          <button
            onClick={() => {
              setDraft({ name: t.name, info: t.info, notes: t.notes })
              setEditing(true)
            }}
            aria-label={`Edit ${label}`}
            className={`${btn} border border-line-strong hover:bg-soft`}
          >
            Edit
          </button>
          {t.checkedInAt ? (
            <button
              disabled={pending}
              onClick={() => {
                if (confirm(`Undo the check-in for ${label}? They’ll need to be checked in again.`))
                  act(() => undoCheckInAction(event, t.ticket), `Undid the check-in for ${label}.`)
              }}
              aria-label={`Undo check-in for ${label}`}
              className={`${btn} border border-bad/40 text-bad hover:bg-bad/5`}
            >
              Undo
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => act(() => manualCheckInAction(event, t.ticket), `Checked in ${label}.`)}
              aria-label={`Check in ${label}`}
              className={`${btn} bg-primary px-5 font-bold text-primary-ink hover:bg-primary-hover`}
            >
              {pending ? 'Checking in…' : 'Check in'}
            </button>
          )}
        </span>
      )}
    </li>
  )
}
