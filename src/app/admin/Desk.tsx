'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { arrivalCounts, headline } from '@/lib/display'
import type { LogEntry, LogResult, Ticket } from '@/lib/types'
import GuestList from './GuestList'

type Stats = {
  total: number
  named: number
  namedCheckedIn: number
  checkedIn: number
  perStaff: { name: string; count: number }[]
  recent: LogEntry[]
}

const POLL_MS = 10_000

const RESULT_TEXT: Record<LogResult, string> = {
  checked_in: '',
  already_checked_in: 'already used',
  not_found: 'not a valid ticket',
  wrong_event: 'other event',
  event_closed: 'event closed',
  undone: 'check-in undone',
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function Desk({ event, tickets, readOnly }: { event: string; tickets: Ticket[]; readOnly: boolean }) {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const seen = useRef<number | null>(null)
  const names = useMemo(() => new Map(tickets.map((t) => [t.ticket, t.name])), [tickets])
  const initial = useMemo(() => arrivalCounts(tickets), [tickets])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch(`/api/dashboard?event=${encodeURIComponent(event)}`, { cache: 'no-store' })
          const body = await res.json()
          if (cancelled) return
          if (!res.ok) throw new Error(body.error ?? 'Couldn’t load')
          setStats(body)
          setError('')
          // Someone checked in at the door: refresh the guest list too.
          if (seen.current !== null && seen.current !== body.checkedIn) router.refresh()
          seen.current = body.checkedIn
        } catch (e) {
          if (!cancelled) setError((e as Error).message)
        }
      }
      if (!cancelled) timer = setTimeout(load, POLL_MS)
    }
    load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer)
        load()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [event, router])

  return (
    <>
      {readOnly && (
        <p className="rounded-xl bg-note p-3 text-sm text-note-ink">
          This event is closed, so the list is read-only. Reopen it on Events and QR codes to make changes.
        </p>
      )}
      {/* Real numbers from the start (worked out from the ticket list), so the card never changes size when the refresh lands. */}
      <Arrivals stats={stats ?? initial} error={error} />
      <div className="flex flex-wrap items-start gap-5">
        <GuestList event={event} tickets={tickets} readOnly={readOnly} />
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <section aria-labelledby="live" className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="live" className="text-lg font-extrabold">
                Action log
              </h2>
              {stats && stats.recent.length > 0 && <span className="text-[13px] text-muted">Latest {Math.min(stats.recent.length, 12)} actions</span>}
            </div>
            {/* Fixed height, scrolls inside: new scans never push the cards below it down. */}
            <div className="h-80 overflow-y-auto" tabIndex={0} role="region" aria-label="Latest actions">
            {!stats ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : stats.recent.length === 0 ? (
              <p className="text-sm text-muted">Scans will appear here as soon as the door opens.</p>
            ) : (
              <ol className="flex flex-col">
                {stats.recent.slice(0, 12).map((r, i) => {
                  const ok = r.result === 'checked_in'
                  const name = r.ticket ? names.get(r.ticket)?.trim() : ''
                  const label = r.ticket ? headline({ ticket: r.ticket, name }) : 'Unreadable code'
                  // Ticket number under a name, so the same guest scanned twice is easy to spot.
                  const ref = [name && `Ticket ${r.ticket}`, r.method === 'manual' && 'typed in'].filter(Boolean).join(' · ')
                  return (
                    <li key={`${r.time}-${i}`} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                      <span className={`size-2.5 shrink-0 rounded-full ${ok ? 'bg-ok' : r.result === 'undone' ? 'bg-line-strong' : 'bg-bad'}`} aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <strong className="truncate text-[15px]">{label}</strong>
                        {(ref || !ok) && (
                          <span className="text-[13px] text-muted">
                            {!ok && (
                              <span className={`inline-block font-semibold first-letter:uppercase ${r.result === 'undone' ? '' : 'text-bad-text'}`}>
                                {RESULT_TEXT[r.result]}
                              </span>
                            )}
                            {!ok && ref && ' · '}
                            {ref}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 flex-col items-end text-[13px]">
                        <time dateTime={r.time} className="font-semibold tabular-nums">
                          {time(r.time)}
                        </time>
                        <span className="max-w-28 truncate text-muted">by {r.staffName || 'Unknown'}</span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
            </div>
          </section>

          <section aria-labelledby="team" className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <h2 id="team" className="text-lg font-extrabold">
              Check-ins by person
            </h2>
            {!stats ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : stats.perStaff.length === 0 ? (
              <p className="text-sm text-muted">Nobody has checked anyone in yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats.perStaff.map((s) => (
                  <li key={s.name} className="flex justify-between gap-3 text-[15px]">
                    <span className="min-w-0 truncate">{s.name || 'Unknown'}</span>
                    <strong className="tabular-nums">{s.count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function Arrivals({ stats, error }: { stats: Pick<Stats, 'total' | 'named' | 'namedCheckedIn' | 'checkedIn'>; error: string }) {
  // With names entered, "expected" means named guests; otherwise every printed ticket.
  const expected = stats.named || stats.total
  const arrived = stats.named ? stats.namedCheckedIn : stats.checkedIn
  const walkIns = stats.checkedIn - stats.namedCheckedIn
  const pct = expected ? Math.round((arrived / expected) * 100) : 0
  return (
    <section aria-label="Arrivals" className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-base text-muted">
        <strong className="text-4xl font-extrabold text-ink tabular-nums">{arrived.toLocaleString('en')}</strong> of {expected.toLocaleString('en')}{' '}
        {stats.named ? 'expected guests have arrived' : 'tickets checked in'}
      </p>
      <div role="progressbar" aria-label="Arrived" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-soft">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted">
        {stats.named > 0 && (
          <span>
            <strong className="text-ink">{stats.named - stats.namedCheckedIn}</strong> still to arrive
          </span>
        )}
        {stats.named > 0 && (
          <span>
            <strong className="text-ink">{walkIns}</strong> checked in without a name
          </span>
        )}
        <span>
          <strong className="text-ink">{stats.checkedIn}</strong> checked in altogether
        </span>
        {error && <span className="text-bad-text">Last update failed. Showing the latest numbers we have.</span>}
      </div>
    </section>
  )
}
