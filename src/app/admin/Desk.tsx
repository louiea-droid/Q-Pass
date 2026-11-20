'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { headline } from '@/lib/display'
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
        <p className="rounded-2xl bg-note p-4 text-note-ink">
          This event is closed, so the list is read-only. Reopen it on Events and QR codes to make changes.
        </p>
      )}
      <Arrivals stats={stats} error={error} />
      <div className="flex flex-wrap items-start gap-6">
        <GuestList event={event} tickets={tickets} readOnly={readOnly} />
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <section aria-labelledby="live" className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6">
            <h2 id="live" className="text-xl font-extrabold">
              At the door now
            </h2>
            {!stats ? (
              <p className="text-muted">Loading…</p>
            ) : stats.recent.length === 0 ? (
              <p className="text-muted">Scans will appear here as soon as the door opens.</p>
            ) : (
              <ol className="flex flex-col">
                {stats.recent.slice(0, 12).map((r, i) => {
                  const ok = r.result === 'checked_in'
                  const label = r.ticket ? headline({ ticket: r.ticket, name: names.get(r.ticket) }) : 'Unreadable code'
                  return (
                    <li key={`${r.time}-${i}`} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
                      <span className={`size-2.5 shrink-0 rounded-full ${ok ? 'bg-ok' : r.result === 'undone' ? 'bg-line-strong' : 'bg-bad'}`} aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 flex-col text-[15px]">
                        <strong className="truncate">{label}</strong>
                        {!ok && (
                          <span className={`text-[13px] font-semibold first-letter:uppercase ${r.result === 'undone' ? 'text-muted' : 'text-bad'}`}>
                            {RESULT_TEXT[r.result]}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[13px] text-muted">
                        {r.staffName}, {time(r.time)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          <section aria-labelledby="team" className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6">
            <h2 id="team" className="text-xl font-extrabold">
              Check-ins by person
            </h2>
            {!stats ? (
              <p className="text-muted">Loading…</p>
            ) : stats.perStaff.length === 0 ? (
              <p className="text-muted">Nobody has checked anyone in yet.</p>
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

function Arrivals({ stats, error }: { stats: Stats | null; error: string }) {
  if (!stats)
    return (
      <section className="rounded-3xl border border-line bg-surface p-6" aria-busy="true">
        <p className={error ? 'text-bad' : 'text-muted'} role={error ? 'alert' : 'status'}>
          {error ? `Couldn’t load arrivals: ${error}. Retrying every 10 seconds.` : 'Loading arrivals…'}
        </p>
      </section>
    )
  // With names entered, "expected" means named guests; otherwise every printed ticket.
  const expected = stats.named || stats.total
  const arrived = stats.named ? stats.namedCheckedIn : stats.checkedIn
  const walkIns = stats.checkedIn - stats.namedCheckedIn
  const pct = expected ? Math.round((arrived / expected) * 100) : 0
  return (
    <section aria-label="Arrivals" className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
      <p className="text-xl text-muted">
        <strong className="text-5xl font-extrabold text-ink tabular-nums">{arrived}</strong> of {expected}{' '}
        {stats.named ? 'expected guests have arrived' : 'tickets checked in'}
      </p>
      <div role="progressbar" aria-label="Arrived" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-3.5 overflow-hidden rounded-full bg-soft">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-10 gap-y-2 text-[15px] text-muted">
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
        {error && <span className="text-bad">Last update failed. Showing the latest numbers we have.</span>}
      </div>
    </section>
  )
}
