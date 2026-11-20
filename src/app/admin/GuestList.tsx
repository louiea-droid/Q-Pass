'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { manualCheckInAction, undoCheckInAction, updateTicketAction } from '../actions'
import { headline, matchTicket, type TicketFilter } from '@/lib/display'
import type { Ticket } from '@/lib/types'
import Pager from './Pager'
import { groupCounts, groupKey } from '@/lib/groups'

type Filter = TicketFilter
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'out', label: 'Not arrived' },
  { id: 'in', label: 'Arrived' },
  { id: 'notgiven', label: 'No name' },
]
const fmt = (iso: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

export default function GuestList({ event, tickets, readOnly }: { event: string; tickets: Ticket[]; readOnly: boolean }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)

  const q = query.trim().toLowerCase()
  const matches = tickets.filter((t) => matchTicket(t, query, filter))
  const groups = groupCounts(tickets)
  // The list refreshes as people arrive; stay on a page that still exists.
  const current = Math.min(page, Math.max(0, Math.ceil(matches.length / size) - 1))
  const shown = matches.slice(current * size, current * size + size)

  return (
    <section aria-labelledby="find" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <h2 id="find" className="text-lg font-extrabold">
        Find a guest
      </h2>
      <label className="relative block">
        <span className="sr-only">Search by name or ticket number</span>
        <svg className="pointer-events-none absolute top-3 left-3.5 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="Name or ticket number"
          className="h-11 w-full rounded-lg border-[1.5px] border-line-strong bg-surface pr-3 pl-10 text-[15px] font-medium focus:border-primary focus:outline-none"
        />
      </label>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Show</legend>
        {FILTERS.map((f) => (
          <label
            key={f.id}
            className={`flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors duration-200 has-focus-visible:outline-3 has-focus-visible:outline-gold ${
              filter === f.id ? 'border-primary bg-primary text-primary-ink' : 'border-line-strong bg-surface hover:bg-soft'
            }`}
          >
            <input type="radio" name="filter" value={f.id} checked={filter === f.id}
              onChange={() => {
                setFilter(f.id)
                setPage(0)
              }}
              className="sr-only"
            />
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
        <ul className="flex flex-col gap-2">
          {shown.map((t) => (
            <Guest key={t.ticket} event={event} t={t} group={groups.get(groupKey(t.name))} readOnly={readOnly} onStatus={setStatus} />
          ))}
        </ul>
      )}
      {status && (
        <p role="status" className="text-sm font-semibold text-ok-text">
          {status}
        </p>
      )}
      {matches.length > 0 && (
        <Pager
          page={current}
          size={size}
          total={matches.length}
          onPage={setPage}
          onSize={(s) => {
            setSize(s)
            setPage(0)
          }}
        />
      )}
    </section>
  )
}

function Guest({
  event,
  t,
  group,
  readOnly,
  onStatus,
}: {
  event: string
  t: Ticket
  group?: { total: number; here: number }
  readOnly: boolean
  onStatus: (s: string) => void
}) {
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

  const btn = 'h-9 rounded-lg px-3.5 text-sm font-semibold transition-colors duration-200 disabled:opacity-60'

  if (editing)
    return (
      <li className="flex flex-col gap-3 rounded-xl border-2 border-primary p-4">
        <span className="text-[15px] font-extrabold tabular-nums">Ticket {t.ticket}</span>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['name', 'info', 'notes'] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1.5 text-sm font-bold capitalize">
              {k === 'info' ? 'Group or info' : k}
              <input
                value={draft[k]}
                autoComplete="off"
                autoFocus={k === 'name'}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-[15px] font-medium focus:border-primary focus:outline-none"
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
            <span role="alert" className="text-sm font-semibold text-bad-text">
              {error}
            </span>
          )}
        </div>
      </li>
    )

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line px-4 py-2.5">
      {/* The ticket number is what volunteers match against the paper ticket, so it leads, big. */}
      <span className="w-16 shrink-0 text-xl font-extrabold tabular-nums" aria-label={`Ticket ${t.ticket}`}>
        {t.ticket}
      </span>
      <span className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
        <span className={`text-[15px] wrap-anywhere ${t.name ? 'font-bold' : 'font-medium text-muted'}`}>
          {t.name || 'No name yet'}
          {group && group.total > 1 && (
            <span className="ml-2 rounded-full bg-soft px-2 py-0.5 align-middle text-xs font-semibold text-muted">
              Group of {group.total}, {group.here} here
            </span>
          )}
        </span>
        <span className={`text-[13px] ${t.checkedInAt ? 'font-semibold text-ok-text' : 'text-muted'}`}>
          {t.checkedInAt
            ? `Arrived ${fmt(t.checkedInAt)}, checked in by ${t.checkedInBy || 'someone'}${t.method === 'manual' ? ' (by hand)' : ''}`
            : `Not arrived yet${t.info ? `. ${t.info}` : ''}`}
        </span>
        {error && (
          <span role="alert" className="text-sm font-semibold text-bad-text">
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
              className={`${btn} border border-bad/40 text-bad-text hover:bg-bad/5`}
            >
              Undo
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => act(() => manualCheckInAction(event, t.ticket), `Checked in ${label}.`)}
              aria-label={`Check in ${label}`}
              className={`${btn} bg-primary px-4 font-bold text-primary-ink hover:bg-primary-hover`}
            >
              {pending ? 'Checking in…' : 'Check in'}
            </button>
          )}
        </span>
      )}
    </li>
  )
}
