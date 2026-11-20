import Link from 'next/link'
import { requireStaff } from '@/lib/guard'
import { listEvents } from '@/lib/store'
import { EditEvent, NewEvent } from './EventForm'

export const metadata = { title: 'Events · Q-Pass' }

const STEPS = ['Create the event', 'Download the QR codes', 'Scan them at the door']

const fmtDate = (d: string) =>
  d ? new Date(`${d}T00:00`).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''

export default async function EventsPage() {
  await requireStaff('admin')
  const events = await listEvents()

  if (events.length === 0)
    return (
      <section className="mx-auto flex w-full max-w-xl flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold">Create your first event</h1>
          <p className="text-[15px] text-muted">It takes a minute. Then you can download the QR codes for the tickets.</p>
        </div>
        <ol className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${i === 0 ? 'bg-primary text-primary-ink' : 'bg-soft text-muted'}`}>
                {i + 1}
              </span>
              <span className={`font-semibold ${i === 0 ? '' : 'text-muted'}`}>{s}</span>
            </li>
          ))}
        </ol>
        <NewEvent startOpen />
      </section>
    )

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Events</h1>
      </div>
      <NewEvent />
      <ul className="grid gap-4 lg:grid-cols-2">
        {events.map((e) => {
          const count = Number(e.ticketTo) - Number(e.ticketFrom) + 1
          const open = e.status === 'open'
          return (
            <li key={e.name} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 text-lg font-extrabold wrap-anywhere">{e.name}</h2>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${open ? 'bg-ok/10 text-ok-text' : 'bg-soft text-muted'}`}
                >
                  {open ? 'Open' : 'Closed'}
                </span>
              </div>
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                {e.date && (
                  <div>
                    <dt className="sr-only">Date</dt>
                    <dd>{fmtDate(e.date)}</dd>
                  </div>
                )}
                {e.venue && (
                  <div>
                    <dt className="sr-only">Venue</dt>
                    <dd>{e.venue}</dd>
                  </div>
                )}
                <div>
                  <dt className="sr-only">Tickets</dt>
                  <dd>
                    {count.toLocaleString('en')} tickets, {e.ticketFrom} to {e.ticketTo}
                  </dd>
                </div>
              </dl>
              {e.details && <p className="text-[15px] leading-relaxed">{e.details}</p>}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin?event=${encodeURIComponent(e.name)}`}
                  className="flex h-10 items-center rounded-lg bg-primary px-3.5 text-[15px] font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover"
                >
                  Open desk
                </Link>
                <Link
                  href={`/admin/qr?event=${encodeURIComponent(e.name)}`}
                  className="flex h-10 items-center gap-2 rounded-lg border border-line-strong px-3.5 text-[15px] font-semibold transition-colors duration-200 hover:bg-soft"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                  </svg>
                  QR codes
                </Link>
              </div>
              <EditEvent event={e} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
