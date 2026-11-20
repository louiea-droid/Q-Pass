'use client'

import { useEffect, useState } from 'react'
import type { LogEntry, LogResult } from '@/lib/types'

type Data = {
  total: number
  named: number
  namedCheckedIn: number
  checkedIn: number
  perStaff: { name: string; count: number }[]
  recent: LogEntry[]
}

const POLL_MS = 10_000

const RESULT_TEXT: Record<LogResult, string> = {
  checked_in: 'Checked in',
  already_checked_in: 'Already used',
  not_found: 'Not found',
  wrong_event: 'Other event',
  event_closed: 'Event closed',
  undone: 'Undone',
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })

export default function Dashboard({ event }: { event: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [updatedAt, setUpdatedAt] = useState('')
  const [error, setError] = useState('')

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
          setData(body)
          setUpdatedAt(new Date().toISOString())
          setError('')
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
  }, [event])

  if (!data)
    return error ? (
      <p role="alert" className="mt-6 rounded-md border border-bad p-4 text-bad">
        Couldn’t load the dashboard: {error}. It will retry every 10 seconds.
      </p>
    ) : (
      <p role="status" className="mt-6 text-muted">
        Loading check-ins…
      </p>
    )

  const notYet = data.named - data.namedCheckedIn
  const pct = data.total ? Math.round((data.checkedIn / data.total) * 100) : 0

  return (
    <div className="mt-6">
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="text-2xl">
          <span className="text-5xl font-bold tabular-nums text-primary">{data.checkedIn}</span> of{' '}
          <span className="tabular-nums">{data.total}</span> tickets checked in
        </p>
        <div
          className="mt-4 h-3 overflow-hidden rounded-full bg-paper"
          role="progressbar"
          aria-label="Tickets checked in"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Stat label="Named tickets" value={data.named} />
          <Stat label="Named, not arrived yet" value={notYet} />
          <Stat label="Checked in" value={`${pct}%`} />
        </dl>
        <p className="mt-3 text-xs text-muted" aria-live="polite">
          {error ? `Last update failed (${error}). Showing data from ${time(updatedAt)}.` : `Updated ${time(updatedAt)}`}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section aria-labelledby="by-staff">
          <h2 id="by-staff" className="text-xl font-semibold">
            Check-ins by staff
          </h2>
          {data.perStaff.length === 0 ? (
            <p className="mt-2 text-muted">Nobody has checked anyone in yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
              {data.perStaff.map((s) => (
                <li key={s.name} className="flex justify-between gap-3 px-4 py-2">
                  <span className="min-w-0 truncate" title={s.name}>
                    {s.name || 'Unknown'}
                  </span>
                  <span className="font-semibold tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent">
          <h2 id="recent" className="text-xl font-semibold">
            Recent scans
          </h2>
          {data.recent.length === 0 ? (
            <p className="mt-2 text-muted">Scans will appear here as staff check people in.</p>
          ) : (
            <ol className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
              {data.recent.map((r, i) => {
                const ok = r.result === 'checked_in'
                return (
                  <li key={`${r.time}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2">
                    <span className="w-24 shrink-0 text-sm tabular-nums text-muted">{time(r.time)}</span>
                    <span className="font-semibold tabular-nums">{r.ticket || '—'}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        ok ? 'bg-ok text-on-flag' : r.result === 'undone' ? 'border border-line' : 'bg-bad text-on-flag'
                      }`}
                    >
                      {RESULT_TEXT[r.result] ?? r.result}
                    </span>
                    <span className="ml-auto min-w-0 truncate text-sm text-muted">
                      {r.staffName}
                      {r.method === 'manual' ? ' (typed)' : ''}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
