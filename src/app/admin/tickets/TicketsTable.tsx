'use client'

import { useEffect, useRef, useState } from 'react'
import { updateTicketAction } from '../../actions'
import Pager from '../Pager'
import GiveTickets, { GiveButton } from './GiveTickets'
import { groupCounts, groupKey } from '@/lib/groups'
import { isGiven, matchTicket, type TicketFilter } from '@/lib/display'
import type { Ticket } from '@/lib/types'
import { confirmDialog } from '../../confirm'
import { toast } from '../../toast'

type Fields = { name: string; info: string; notes: string }
type Col = keyof Fields
type RowState = 'saving' | 'saved' | 'error'

const COLS: { key: Col; label: string; width: string }[] = [
  { key: 'name', label: 'Name', width: 'min-w-56' },
  { key: 'info', label: 'Details', width: 'min-w-48' },
  { key: 'notes', label: 'Note', width: 'min-w-48' },
]
const FILTERS: { id: TicketFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'given', label: 'Given' },
  { id: 'notgiven', label: 'Not given' },
  { id: 'in', label: 'Checked in' },
]

const fields = (t: Ticket): Fields => ({ name: t.name, info: t.info, notes: t.notes })
const same = (a?: Fields, b?: Fields) => !a || !b || (a.name === b.name && a.info === b.info && a.notes === b.notes)
const byTicket = (tickets: Ticket[]) => Object.fromEntries(tickets.map((t) => [t.ticket, fields(t)]))
const fmt = (iso: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

export default function TicketsTable({ event, tickets, readOnly }: { event: string; tickets: Ticket[]; readOnly: boolean }) {
  const [draft, setDraft] = useState<Record<string, Fields>>(() => byTicket(tickets))
  const [saved, setSaved] = useState<Record<string, Fields>>(draft)
  // Fresh data from the server (after "Import names" or a refresh): take it, except on rows being edited right now.
  const [seen, setSeen] = useState(tickets)
  if (tickets !== seen) {
    setSeen(tickets)
    const fresh = byTicket(tickets)
    setDraft((d) => Object.fromEntries(tickets.map((t) => [t.ticket, same(d[t.ticket], saved[t.ticket]) ? fresh[t.ticket] : d[t.ticket]])))
    setSaved(fresh)
  }
  const [rowState, setRowState] = useState<Record<string, RowState>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TicketFilter>('all')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [giving, setGiving] = useState(false)
  // The bigger note editor: a native popover (top layer, so the scrolling table can't clip it).
  const [pop, setPop] = useState<{ ticket: string; top: number; left: number } | null>(null)
  const popRef = useRef<HTMLDivElement>(null)
  // A mouse press focuses the cell before the button comes up; opening the box then would close it again at once
  // (the release lands outside it). So a click opens it on click, and focus opens it only from the keyboard.
  const pressing = useRef(false)
  useEffect(() => {
    if (!pop) return
    popRef.current?.showPopover()
    popRef.current?.querySelector('textarea')?.focus()
  }, [pop])
  // A note too long for its cell moves into the bigger editor, just below the cell.
  function growNote(ticket: string, el: HTMLInputElement) {
    if (el.scrollWidth <= el.clientWidth) return
    const r = el.getBoundingClientRect()
    setPop({ ticket, top: r.bottom + 6, left: Math.max(8, Math.min(r.left, innerWidth - 296)) })
  }

  // Filter on what's saved, and keep a row with unsaved typing: otherwise typing a name under "Not given"
  // would hide the row mid-word, and its input with it, before the edit is saved.
  const rows = tickets.map((t) => ({ ...t, ...saved[t.ticket] }))
  const matches = rows.filter((t) => !same(draft[t.ticket], saved[t.ticket]) || matchTicket(t, query, filter))
  const pages = Math.max(1, Math.ceil(matches.length / size))
  const current = Math.min(page, pages - 1)
  const shown = matches.slice(current * size, current * size + size)
  const given = rows.filter(isGiven).length
  const groups = groupCounts(rows)

  // After "Give tickets": show the new names at once, already saved.
  function given_(numbers: string[], name: string, info: string) {
    const apply = (x: Record<string, Fields>) => {
      const next = { ...x }
      for (const n of numbers) next[n] = { ...next[n], name, ...(info && { info }) }
      return next
    }
    setDraft(apply)
    setSaved(apply)
    setRowState((x) => ({ ...x, ...Object.fromEntries(numbers.map((n) => [n, 'saved' as const])) }))
    setQuery(name)
    setFilter('all')
    setPage(0)
  }

  async function save(ticket: string) {
    const d = draft[ticket], s = saved[ticket]
    // Nothing to save (e.g. Escape put it back): clear a "Not saved" left from an earlier try.
    if (same(d, s)) return setRowState((x) => (x[ticket] === 'error' ? { ...x, [ticket]: 'saved' } : x))
    setRowState((r) => ({ ...r, [ticket]: 'saving' }))
    try {
      // Only the fields that changed, so this never writes back stale values over someone else's edit.
      const changed = Object.fromEntries((['name', 'info', 'notes'] as const).filter((k) => d[k] !== s[k]).map((k) => [k, d[k]]))
      const r = await updateTicketAction(event, ticket, changed)
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

  // "Ungive": clear the person's name, details and notes so the ticket is free again.
  async function remove(t: { ticket: string; name: string }) {
    const ok = await confirmDialog({
      title: `Remove ${t.name}?`,
      message: `Ticket ${t.ticket} becomes “Not given” and their details are cleared.`,
      action: 'Remove',
    })
    if (!ok) return
    const blank = { name: '', info: '', notes: '' }
    setRowState((x) => ({ ...x, [t.ticket]: 'saving' }))
    try {
      const r = await updateTicketAction(event, t.ticket, blank)
      if (r.error) throw new Error(r.error)
      setDraft((x) => ({ ...x, [t.ticket]: blank }))
      setSaved((x) => ({ ...x, [t.ticket]: blank }))
      setRowState((x) => ({ ...x, [t.ticket]: 'saved' }))
      toast(`Ticket ${t.ticket} is free again.`)
    } catch (e) {
      setRowState((x) => ({ ...x, [t.ticket]: 'error' }))
      setErrors((x) => ({ ...x, [t.ticket]: (e as Error).message || 'Couldn’t remove' }))
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
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-base text-muted">
            <strong className="text-2xl font-extrabold text-ink tabular-nums">{given.toLocaleString('en')}</strong> of{' '}
            {rows.length.toLocaleString('en')} tickets given
          </p>
        </div>
        {readOnly ? (
          <p className="rounded-lg bg-note px-3 py-1.5 text-sm text-note-ink">This event is closed, so tickets are read-only.</p>
        ) : (
          <GiveButton
            onClick={() => {
              setGiving(true)
            }}
          />
        )}
      </div>

      {giving && <GiveTickets event={event} rows={rows} onGiven={given_} onClose={() => setGiving(false)} onDone={toast} />}

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
              className={`flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors duration-200 has-focus-visible:outline-3 has-focus-visible:outline-ring ${
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
        <>
        {/* On phones only Ticket and Name fit; say the rest is a swipe away. */}
        <p className="-mb-1 text-xs text-muted sm:hidden">Swipe the table sideways to see details and notes.</p>
        {/* No inner scroll: the page scrolls. Phones still swipe sideways; on wide screens clip (not scroll) so the headings stick under the admin header. */}
        <div className="relative overflow-x-auto rounded-xl border border-line lg:overflow-x-clip">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 lg:top-[65px] bg-soft text-[13px] whitespace-nowrap text-muted shadow-[0_1px_0_var(--line)]">
              <tr>
                <th scope="col" className="w-20 px-3 py-2.5 font-semibold">Ticket</th>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" className={`px-2 py-2.5 font-semibold ${c.width}`}>
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="w-28 px-3 py-2.5 font-semibold">Status</th>
                <th scope="col" className="w-24 px-3 py-2.5 font-semibold">Group</th>
                <th scope="col" className="w-36 px-3 py-2.5 font-semibold">Checked in</th>
                {!readOnly && (
                  <th scope="col" className="w-24 px-2 py-2.5">
                    <span className="sr-only">Remove</span>
                  </th>
                )}
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
                          placeholder="—"
                          title={draft[t.ticket][c.key] || undefined}
                          onChange={(e) => {
                            edit(t.ticket, c.key, e.target.value)
                            if (c.key === 'notes') growNote(t.ticket, e.currentTarget)
                          }}
                          // Not when focus comes back from the note box as it closes, or it would pop right open again.
                          onFocus={(e) =>
                            c.key === 'notes' &&
                            !readOnly &&
                            !pressing.current &&
                            !(pop?.ticket === t.ticket && (e.relatedTarget as Element | null)?.closest('[popover]')) &&
                            growNote(t.ticket, e.currentTarget)
                          }
                          onPointerDown={() => c.key === 'notes' && (pressing.current = true)}
                          onClick={(e) => {
                            if (c.key !== 'notes') return
                            pressing.current = false
                            if (!readOnly) growNote(t.ticket, e.currentTarget)
                          }}
                          onBlur={() => save(t.ticket)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              next(t.ticket, c.key)
                            } else if (e.key === 'Escape') edit(t.ticket, c.key, saved[t.ticket][c.key])
                          }}
                          className={readOnly ? 'h-9 w-full border-0 bg-transparent px-2 text-sm' : `h-9 w-full rounded-md border border-transparent bg-transparent px-2.5 text-sm transition-colors duration-150 placeholder:text-muted/60 hover:border-primary/60 focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/25 focus:outline-none`}
                        />
                      </td>
                    ))}
                    {/* Pills never break across lines; the table scrolls sideways instead. */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {state === 'saving' ? (
                        <span className="text-[13px] text-muted">Saving…</span>
                      ) : state === 'error' ? (
                        <span role="alert" className="text-[13px] font-semibold text-bad-text" title={errors[t.ticket]}>
                          Not saved
                        </span>
                      ) : isGiven(t) ? (
                        <span className="rounded-full bg-ok/10 px-2.5 py-0.5 text-[13px] font-bold text-ok-text">Given</span>
                      ) : (
                        <span className="rounded-full bg-soft px-2.5 py-0.5 text-[13px] font-semibold text-muted">Not given</span>
                      )}
                    </td>
                    {/* Tickets under the same name (a family). Blank for one ticket. */}
                    <td className="px-3 py-1.5 text-[13px] whitespace-nowrap text-muted tabular-nums">
                      {isGiven(t) && (groups.get(groupKey(t.name))?.total ?? 0) > 1 && `${groups.get(groupKey(t.name))!.total} tickets`}
                    </td>
                    <td className="px-3 py-1.5 text-[13px] whitespace-nowrap text-muted">
                      {t.checkedInAt ? `${fmt(t.checkedInAt)} by ${t.checkedInBy || 'someone'}` : 'Not yet'}
                    </td>
                    {!readOnly && (
                      <td className="px-2 py-1.5 text-right">
                        {isGiven(saved[t.ticket]) && (
                          <button
                            onClick={() => remove({ ticket: t.ticket, name: saved[t.ticket].name })}
                            disabled={!!t.checkedInAt || state === 'saving'}
                            title={t.checkedInAt ? 'Already checked in. Undo the check-in on the Check-in desk first.' : undefined}
                            aria-label={`Remove ${saved[t.ticket].name} from ticket ${t.ticket}`}
                            className="h-8 rounded-md border border-bad/40 px-2.5 text-[13px] font-semibold text-bad-text transition-colors duration-150 hover:bg-bad/10 disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:opacity-60"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {pop && (
        // ponytail: fixed at the button's spot when opened; it doesn't follow if the table scrolls (light-dismiss closes it on outside clicks).
        <div
          key={pop.ticket}
          ref={popRef}
          popover="auto"
          onToggle={(e) => e.newState === 'closed' && setPop((p) => (p?.ticket === pop.ticket ? null : p))}
          style={{ top: pop.top, left: pop.left }}
          className="fixed inset-auto m-0 w-72 rounded-xl border border-line bg-surface p-3 text-ink shadow-2xl"
        >
          <label htmlFor="note-pop" className="mb-1.5 block text-[13px] font-semibold text-muted">
            Note for ticket {pop.ticket}
          </label>
          <textarea
            id="note-pop"
            rows={4}
            // Keep typing where you left off in the cell.
            onFocus={(e) => {
              delete e.currentTarget.dataset.cancel // an Escape from last time must not block this edit's save
              e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)
            }}
            value={draft[pop.ticket].notes}
            onChange={(e) => edit(pop.ticket, 'notes', e.target.value)}
            // Clicking Save, clicking outside or pressing Enter all blur the box, which saves it.
            onBlur={(e) => !e.currentTarget.dataset.cancel && save(pop.ticket)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.blur()
                popRef.current?.hidePopover()
              } else if (e.key === 'Escape') {
                // Escape throws the typing away; mark it so the blur doesn't save it.
                e.currentTarget.dataset.cancel = '1'
                edit(pop.ticket, 'notes', saved[pop.ticket].notes)
              }
            }}
            className="w-full resize-none rounded-md border border-line-strong bg-paper px-2.5 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">Enter saves, Esc cancels</span>
            <button
              type="button"
              onClick={() => popRef.current?.hidePopover()}
              className="h-8 rounded-md bg-primary px-3 text-[13px] font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <p role="status" className={`text-sm ${Object.values(rowState).includes('error') ? 'font-semibold text-bad-text' : 'text-muted'}`}>
        {Object.values(rowState).includes('error')
          ? 'Some changes weren’t saved. Click the field and press Enter to try again.'
          : 'Changes save automatically.'}
      </p>
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
    </section>
  )
}
