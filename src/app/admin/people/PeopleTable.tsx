'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { manualCheckInAction, undoCheckInAction, updateTicketAction } from '../../actions'
import type { Ticket } from '@/lib/types'

type Filter = 'all' | 'in' | 'out' | 'noname'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'Checked in' },
  { id: 'out', label: 'Not checked in' },
  { id: 'noname', label: 'No name' },
]

const fmt = (iso: string) =>
  iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

export default function PeopleTable({ event, tickets, readOnly }: { event: string; tickets: Ticket[]; readOnly: boolean }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [status, setStatus] = useState('')

  const q = query.trim().toLowerCase()
  const rows = tickets.filter((t) => {
    if (filter === 'in' && !t.checkedInAt) return false
    if (filter === 'out' && t.checkedInAt) return false
    if (filter === 'noname' && t.name) return false
    return !q || t.ticket.includes(q) || t.name.toLowerCase().includes(q) || t.info.toLowerCase().includes(q)
  })

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="people-search" className="text-sm font-semibold">
            Search by ticket number or name
          </label>
          <input
            id="people-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="0057 or Juan"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </div>
        <fieldset className="flex flex-wrap gap-1">
          <legend className="sr-only">Show</legend>
          {FILTERS.map((f) => (
            <label
              key={f.id}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm has-focus-visible:outline-3 has-focus-visible:outline-wheat ${
                filter === f.id ? 'border-pine bg-pine text-pine-ink' : 'border-line bg-surface'
              }`}
            >
              <input
                type="radio"
                name="filter"
                value={f.id}
                checked={filter === f.id}
                onChange={() => setFilter(f.id)}
                className="sr-only"
              />
              {f.label}
            </label>
          ))}
        </fieldset>
      </div>

      <p role="status" className="mt-3 text-sm text-muted">
        {status || `Showing ${rows.length} of ${tickets.length} tickets`}
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-muted">
          No tickets match{q ? ` “${query}”` : ''}.{' '}
          <button
            className="underline"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            Clear search and filters
          </button>
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Ticket</th>
                <th scope="col" className="px-3 py-2">Name</th>
                <th scope="col" className="px-3 py-2">Info</th>
                <th scope="col" className="px-3 py-2">Notes</th>
                <th scope="col" className="px-3 py-2">Check-in</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((t) => (
                <Row key={t.ticket} event={event} t={t} readOnly={readOnly} onStatus={setStatus} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Row({ event, t, readOnly, onStatus }: { event: string; t: Ticket; readOnly: boolean; onStatus: (s: string) => void }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: t.name, info: t.info, notes: t.notes })
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

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

  const label = t.name || `ticket ${t.ticket}`

  if (editing)
    return (
      <tr className="bg-paper">
        <td className="px-3 py-2 font-semibold tabular-nums">{t.ticket}</td>
        {(['name', 'info', 'notes'] as const).map((k) => (
          <td key={k} className="px-3 py-2">
            <label className="sr-only" htmlFor={`${k}-${t.ticket}`}>
              {k} for ticket {t.ticket}
            </label>
            <input
              id={`${k}-${t.ticket}`}
              value={draft[k]}
              autoComplete="off"
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              className="w-full rounded border border-line bg-surface px-2 py-1"
            />
          </td>
        ))}
        <td className="px-3 py-2 text-muted">{fmt(t.checkedInAt)}</td>
        <td className="px-3 py-2">
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() => act(() => updateTicketAction(event, t.ticket, draft), `Saved ticket ${t.ticket}.`)}
              className="rounded bg-pine px-3 py-1 font-semibold text-pine-ink disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              disabled={pending}
              onClick={() => {
                setDraft({ name: t.name, info: t.info, notes: t.notes })
                setEditing(false)
              }}
              className="rounded border border-line px-3 py-1"
            >
              Cancel
            </button>
          </div>
          {error && <p role="alert" className="mt-1 text-bad">{error}</p>}
        </td>
      </tr>
    )

  return (
    <tr>
      <td className="px-3 py-2 font-semibold tabular-nums">{t.ticket}</td>
      <td className="max-w-48 px-3 py-2 wrap-anywhere">{t.name || <span className="text-muted">No name</span>}</td>
      <td className="max-w-48 px-3 py-2 wrap-anywhere">{t.info}</td>
      <td className="max-w-48 px-3 py-2 wrap-anywhere">{t.notes}</td>
      <td className="px-3 py-2">
        {t.checkedInAt ? (
          <>
            <span className="font-semibold text-ok">{fmt(t.checkedInAt)}</span>
            <span className="block text-xs text-muted">
              by {t.checkedInBy || 'unknown'}
              {t.method === 'manual' ? ' (manual)' : ''}
            </span>
          </>
        ) : (
          <span className="text-muted">Not yet</span>
        )}
      </td>
      <td className="px-3 py-2">
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setDraft({ name: t.name, info: t.info, notes: t.notes })
                setEditing(true)
              }}
              className="rounded border border-line px-3 py-1" aria-label={`Edit ${label}`}>
              Edit
            </button>
            {t.checkedInAt ? (
              <button
                disabled={pending}
                onClick={() => {
                  if (confirm(`Undo check-in for ${label}? They’ll need to be checked in again.`))
                    act(() => undoCheckInAction(event, t.ticket), `Undid check-in for ${label}.`)
                }}
                className="rounded border border-bad px-3 py-1 text-bad disabled:opacity-60"
                aria-label={`Undo check-in for ${label}`}
              >
                Undo
              </button>
            ) : (
              <button
                disabled={pending}
                onClick={() => act(() => manualCheckInAction(event, t.ticket), `Checked in ${label}.`)}
                className="rounded bg-pine px-3 py-1 font-semibold text-pine-ink disabled:opacity-60"
                aria-label={`Check in ${label}`}
              >
                {pending ? 'Checking in…' : 'Check in'}
              </button>
            )}
          </div>
        )}
        {error && <p role="alert" className="mt-1 text-bad">{error}</p>}
      </td>
    </tr>
  )
}
