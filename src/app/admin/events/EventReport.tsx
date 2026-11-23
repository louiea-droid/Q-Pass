import { arrivalBuckets, arrivalCounts, noShows } from '@/lib/display'
import type { EventInfo, Ticket } from '@/lib/types'
import ArrivalsChart from './ArrivalsChart'

const SHOW = 50

/** After-event report: totals, arrivals per 15 minutes, and who didn't come. */
export default function EventReport({ event, tickets }: { event: EventInfo; tickets: Ticket[] }) {
  const c = arrivalCounts(tickets)
  const missing = noShows(tickets)
  const stats = [
    ['Tickets given', c.named],
    ['Arrived', c.checkedIn],
    ['No-shows', missing.length],
    ['Checked in without a name', c.checkedIn - c.namedCheckedIn],
  ] as const
  return (
    <section id="report" aria-labelledby="report-title" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 id="report-title" className="text-xl font-extrabold">
        Report
      </h2>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-xl bg-paper p-3">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-2xl font-extrabold tabular-nums">{n.toLocaleString('en')}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-extrabold">Arrivals per 15 minutes</h3>
        <ArrivalsChart buckets={arrivalBuckets(tickets.map((t) => t.checkedInAt))} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-extrabold">No-shows</h3>
          {missing.length > 0 && (
            <a
              href={`/api/export?event=${encodeURIComponent(event.name)}&only=noshow`}
              className="flex h-9 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm font-semibold hover:bg-soft"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Download no-shows
            </a>
          )}
        </div>
        {missing.length === 0 ? (
          <p className="text-sm text-muted">Everyone with a name arrived.</p>
        ) : (
          <ul className="flex flex-col">
            {missing.slice(0, SHOW).map((t) => (
              <li key={t.ticket} className="flex items-baseline gap-3 border-b border-line py-2 text-[15px] last:border-0">
                <span className="w-11 shrink-0 font-bold tabular-nums">{t.ticket}</span>
                <span className="min-w-0 flex-1 wrap-anywhere">
                  {t.name}
                  {t.info && <span className="text-muted"> · {t.info}</span>}
                </span>
              </li>
            ))}
            {missing.length > SHOW && <li className="pt-2 text-sm text-muted">and {missing.length - SHOW} more in the download</li>}
          </ul>
        )}
      </div>
    </section>
  )
}
