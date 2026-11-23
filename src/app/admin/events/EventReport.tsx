import { arrivalBuckets, arrivalCounts, noShows } from '@/lib/display'
import type { EventInfo, Ticket } from '@/lib/types'
import ArrivalsChart from './ArrivalsChart'

const card = 'flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5'

/** After-event report: totals, arrivals per 15 minutes beside the no-show list. */
export default function EventReport({ event, tickets }: { event: EventInfo; tickets: Ticket[] }) {
  const c = arrivalCounts(tickets)
  const missing = noShows(tickets)
  const pct = (n: number) => (c.named ? `${Math.round((n / c.named) * 100)}% of tickets given` : '')
  const stats: { label: string; value: number; note?: string }[] = [
    { label: 'Tickets given', value: c.named, note: `of ${tickets.length.toLocaleString('en')} printed` },
    { label: 'Arrived', value: c.namedCheckedIn, note: pct(c.namedCheckedIn) },
    { label: 'No-shows', value: missing.length, note: pct(missing.length) },
    { label: 'Checked in without a name', value: c.checkedIn - c.namedCheckedIn },
  ]

  return (
    <div id="report" className="flex flex-col gap-5">
      <h2 className="sr-only">Report</h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="text-3xl font-extrabold tabular-nums">{s.value.toLocaleString('en')}</dd>
            {s.note && <dd className="text-xs text-muted">{s.note}</dd>}
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="arrivals-title" className={card}>
          <h3 id="arrivals-title" className="text-base font-extrabold">
            Arrivals per 15 minutes
          </h3>
          <ArrivalsChart buckets={arrivalBuckets(tickets.map((t) => t.checkedInAt))} />
        </section>

        <section aria-labelledby="noshow-title" className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="noshow-title" className="text-base font-extrabold">
              No-shows <span className="font-semibold text-muted tabular-nums">({missing.length})</span>
            </h3>
            {missing.length > 0 && (
              <a
                href={`/api/export?event=${encodeURIComponent(event.name)}&only=noshow`}
                className="flex h-9 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm font-semibold hover:bg-soft"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                </svg>
                Download
              </a>
            )}
          </div>
          {missing.length === 0 ? (
            <p className="text-sm text-muted">Everyone with a name arrived.</p>
          ) : (
            // Fixed height, scrolls inside, so a long list doesn't push the page down.
            <ul className="-mx-1 flex max-h-80 flex-col overflow-y-auto px-1" tabIndex={0} aria-label="No-show list">
              {missing.map((t) => (
                <li key={t.ticket} className="flex items-baseline gap-3 border-b border-line py-2 text-[15px] last:border-0">
                  <span className="w-11 shrink-0 text-sm font-bold text-muted tabular-nums">{t.ticket}</span>
                  <span className="min-w-0 flex-1 wrap-anywhere">
                    {t.name}
                    {t.info && <span className="block text-sm text-muted">{t.info}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
