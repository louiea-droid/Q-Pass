'use client'

import { useState } from 'react'
import { updateTicketAction } from '../../actions'
import { isGiven, matchTicket, type TicketFilter } from '@/lib/display'
import type { Ticket } from '@/lib/types'

type Fields = { name: string; info: string; notes: string }
type Col = keyof Fields
type RowState = 'saving' | 'saved' | 'error'

const PAGE = 100
const COLS: { key: Col; label: string; width: string }[] = [
  { key: 'name', label: 'Name', width: 'min-w-56' },
  { key: 'info', label: 'Details', width: 'min-w-48' },
  { key: 'notes', label: 'Notes', width: 'min-w-48' },
]
const FILTERS: { id: TicketFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'given', label: 'Given' },
  { id: 'notgiven', label: 'Not given' },
  { id: 'in', label: 'Checked in' },
]

const fields = (t: Ticket): Fields => ({ name: t.name, info: t.info, notes: t.notes })
const fmt = (iso: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

export default function TicketsTable({ event, tickets, readOnly }: { event: string; tickets: Ticket[]; readOnly: boolean }) {
  const [draft, setDraft] = useState<Record<string, Fields>>(() => Object.fromEntries(tickets.map((t) => [t.ticket, fields(t)])))
  const [saved, setSaved] = useState<Record<string, Fields>>(draft)
  const [rowState, setRowState] = useState<Record<string, RowState>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TicketFilter>('all')
  const [page, setPage] = useState(0)

  // Filter on what's typed, so a name you just entered moves the ticket to "Given" right away.
  const rows = tickets.map((t) => ({ ...t, ...draft[t.ticket] }))
  const matches = rows.filter((t) => matchTicket(t, query, filter))
  const pages = Math.max(1, Math.ceil(matches.length / PAGE))
  const current = Math.min(page, pages - 1)
  const shown = matches.slice(current * PAGE, current * PAGE + PAGE)
  const given = rows.filter(isGiven).length

  async function save(ticket: string) {
    const d = draft[ticket], s = saved[ticket]
    if (d.name === s.name && d.info === s.info && d.notes === s.notes) return
    setRowState((r) => ({ ...r, [ticket]: 'saving' }))
    try {
      const r = await updateTicketAction(event, ticket, d)
      if (r.error) throw new Error(r.error)
      setSaved((x) => ({ ...x, [ticket]: d }))
      setRowState((x) => ({ ...x, [ticket]: 'saved' }))
      setErrors((x) => {
        const rest = { ...x }
        delete rest[ticket]
        return rest
      })
    } catch (e) {
      setRowState((x) => ({ ...x, [ticket]: 'error' }))
      setErrors((x) => ({ ...x, [ticket]: (e as Error).message || 'Couldn’t save' }))
    }
  }

  function edit(ticket: string, col: Col, value: string) {
    setDraft((d) => ({ ...d, [ticket]: { ...d[ticket], [col]: value } }))
  }

  // Enter moves to the same column in the next row, for quick typing while handing tickets out.
  function next(ticket: string, col: Col) {
    const i = shown.findIndex((t) => t.ticket === ticket)
    const nextRow = shown[i + 1]
    if (nextRow) document.getElementById(`${col}-${nextRow.ticket}`)?.focus()
    else (document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-muted">
          <strong className="text-2xl font-extrabold text-ink tabular-nums">{given.toLocaleString('en')}</strong> of{' '}
          {rows.length.toLocaleString('en')} tickets given
        </p>
        {readOnly && <p className="rounded-lg bg-note px-3 py-1.5 text-sm text-note-ink">This event is closed, so tickets are read-only.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-[1_1_260px]">
          <span className="sr-only">Search by name, ticket number or details</span>
          <svg className="pointer-events-none absolute top-2.5 left-3 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
            placeholder="Search name, number or details"
            className="h-10 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-[15px] focus:border-primary focus:outline-none"
          />
        </label>
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">Show</legend>
          {FILTERS.map((f) => (
            <label
              key={f.id}
              className={`flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors duration-200 has-focus-visible:outline-3 has-focus-visible:outline-gold ${
                filter === f.id ? 'border-primary bg-primary text-primary-ink' : 'border-line-strong hover:bg-soft'
              }`}
            >
              <input
                type="radio"
                name="ticket-filter"
                checked={filter === f.id}
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
      </div>

      {matches.length === 0 ? (
        <p className="py-8 text-center text-muted">
          No tickets match.{' '}
          <button
            className="font-semibold text-primary underline"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            Show all tickets
          </button>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-soft text-[13px] text-muted">
              <tr>
                <th scope="col" className="w-20 px-3 py-2.5 font-semibold">Ticket</th>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" className={`px-2 py-2.5 font-semibold ${c.width}`}>
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="w-28 px-3 py-2.5 font-semibold">Status</th>
                <th scope="col" className="w-36 px-3 py-2.5 font-semibold">Checked in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((t) => {
                const state = rowState[t.ticket]
                return (
                  <tr key={t.ticket} className="hover:bg-soft/50">
                    <th scope="row" className="px-3 py-1.5 font-bold tabular-nums">
                      {t.ticket}
                    </th>
                    {COLS.map((c) => (
                      <td key={c.key} className="px-1 py-1">
                        <label htmlFor={`${c.key}-${t.ticket}`} className="sr-only">
                          {c.label} for ticket {t.ticket}
                        </label>
                        <input
                          id={`${c.key}-${t.ticket}`}
                          value={draft[t.ticket][c.key]}
                          readOnly={readOnly}
                          autoComplete="off"
                          placeholder={c.key === 'name' && !readOnly ? 'Add a name' : ''}
                          onChange={(e) => edit(t.ticket, c.key, e.target.value)}
                          onBlur={() => save(t.ticket)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              next(t.ticket, c.key)
                            } else if (e.key === 'Escape') edit(t.ticket, c.key, saved[t.ticket][c.key])
                          }}
                          className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-line-strong focus:border-primary focus:bg-surface focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-1.5">
                      {state === 'saving' ? (
                        <span className="text-[13px] text-muted">Saving…</span>
                      ) : state === 'error' ? (
                        <span role="alert" className="text-[13px] font-semibold text-bad" title={errors[t.ticket]}>
                          Not saved
                        </span>
                      ) : isGiven(t) ? (
                        <span className="rounded-full bg-ok/10 px-2.5 py-0.5 text-[13px] font-bold text-ok-text">Given</span>
                      ) : (
                        <span className="rounded-full bg-soft px-2.5 py-0.5 text-[13px] font-semibold text-muted">Not given</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-[13px] text-muted">
                      {t.checkedInAt ? `${fmt(t.checkedInAt)} by ${t.checkedInBy || 'someone'}` : 'Not yet'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span role="status">
          {Object.values(rowState).includes('error')
            ? 'Some changes weren’t saved. Click the field and press Enter to try again.'
            : `Showing ${matches.length ? current * PAGE + 1 : 0}–${current * PAGE + shown.length} of ${matches.length}. Changes save automatically.`}
        </span>
        {pages > 1 && (
          <span className="flex items-center gap-2">
            <button
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="h-9 rounded-lg border border-line-strong px-3 font-semibold hover:bg-soft disabled:opacity-40"
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {current + 1} of {pages}
            </span>
            <button
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="h-9 rounded-lg border border-line-strong px-3 font-semibold hover:bg-soft disabled:opacity-40"
            >
              Next
            </button>
          </span>
        )}
      </div>
    </section>
  )
}
