'use client'

import { useSyncExternalStore } from 'react'

// Times use the viewer's time zone. The server renders in UTC (Vercel), so times appear only after hydration;
// rendering them on the server would not match the browser and React would throw a hydration error.
const noSubscribe = () => () => {}
const hm = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** Check-ins per 15 minutes as thin bars. One series, so no legend; the busiest slot is named in text. */
export default function ArrivalsChart({ buckets }: { buckets: { start: number; count: number }[] }) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false)
  const time = (ms: number) => (inBrowser ? hm(ms) : '')
  if (!buckets.length) return <p className="text-sm text-muted">No one has checked in yet.</p>
  const max = Math.max(...buckets.map((b) => b.count))
  const peak = buckets.find((b) => b.count === max)!
  // Labels on the hour, fewer when the range is long; none at the very end, where it would be cut off.
  const labelEvery = 4 * Math.max(1, Math.ceil(buckets.length / 24))
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm text-muted">
        Busiest: <strong className="text-ink">{time(peak.start)}</strong>, {max} {max === 1 ? 'arrival' : 'arrivals'} in 15 minutes
      </figcaption>
      <div className="flex gap-2">
        {/* Y axis: just the top value, recessive. */}
        <div className="flex h-40 flex-col justify-between text-right text-xs text-muted tabular-nums" aria-hidden="true">
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex h-40 min-w-full items-end gap-0.5 border-b border-line-strong" style={{ width: `${buckets.length * 8}px` }}>
            {buckets.map((b) => (
              <div key={b.start} className="group relative flex h-full min-w-2 flex-1 items-end">
                <div
                  className="w-full rounded-t-[4px] bg-primary transition-opacity duration-150 group-hover:opacity-80"
                  style={{ height: `${(b.count / max) * 100}%` }}
                />
                {/* Hover: hit target is the whole column, not just the bar. */}
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs font-semibold whitespace-nowrap text-paper group-hover:block">
                  {time(b.start)}: {b.count}
                </span>
              </div>
            ))}
          </div>
          <div className="relative mt-1 h-4 text-xs text-muted" aria-hidden="true" style={{ width: `${buckets.length * 8}px`, minWidth: '100%' }}>
            {buckets.map((b, i) =>
              i % labelEvery === 0 && i < buckets.length - 2 ? (
                <span key={b.start} className="absolute whitespace-nowrap" style={{ left: `${(i / buckets.length) * 100}%` }}>
                  {time(b.start)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      {/* sr-only on a div, not the table: a table ignores height:1px and would stretch the page by a row per slot. */}
      <div className="sr-only">
        <table>
          <caption>Arrivals per 15 minutes</caption>
          <thead>
            <tr>
              <th>From</th>
              <th>Arrivals</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.start}>
                <td>{time(b.start)}</td>
                <td>{b.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
