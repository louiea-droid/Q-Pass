import Link from 'next/link'
import { requireStaff } from '@/lib/guard'
import { listEvents, listTickets } from '@/lib/store'
import { EditEvent, NewEvent } from './EventForm'
import EventReport from './EventReport'

export const metadata = { title: 'Events · Q-Pass' }

const STEPS = ['Create the event', 'Download the QR codes', 'Scan them at the door']

const fmtDate = (d: string) =>
  d ? new Date(`${d}T00:00`).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''

const secondaryLink =
  'flex h-10 items-center rounded-lg border border-line-strong px-3.5 text-[15px] font-semibold transition-colors duration-200 hover:bg-soft'

/** Calendar-style date block, so events can be told apart at a glance. */
function DateTile({ date }: { date: string }) {
  const d = new Date(`${date}T00:00`)
  if (isNaN(d.getTime())) return null
  return (
    <div aria-hidden="true" className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-line bg-paper">
      <span className="w-full bg-primary py-0.5 text-center text-xs font-bold text-primary-ink">
        {d.toLocaleDateString('en', { month: 'short' })}
      </span>
      <span className="pt-1 text-2xl leading-none font-extrabold tabular-nums">{d.getDate()}</span>
      <span className="pb-1.5 text-[11px] font-semibold text-muted">{d.getFullYear()}</span>
    </div>
  )
}

function Meta({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="sr-only">{label}</dt>
      <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon}
      </svg>
      <dd className="min-w-0 wrap-anywhere">{children}</dd>
    </div>
  )
}

export default async function EventsPage({ searchParams }: PageProps<'/admin/events'>) {
  await requireStaff('admin')
  const events = await listEvents()
  const { report } = await searchParams
  const selected = events.find((e) => e.name === report)
  const reportTickets = selected ? await listTickets(selected.name) : []

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
      {selected && <EventReport event={selected} tickets={reportTickets} />}
      <NewEvent />
      <ul className="grid gap-4 lg:grid-cols-2">
        {events.map((e) => {
          const count = Number(e.ticketTo) - Number(e.ticketFrom) + 1
          const open = e.status === 'open'
          const isSelected = e.name === selected?.name
          return (
            <li
              key={e.name}
              aria-current={isSelected ? 'true' : undefined}
              className={`flex flex-col gap-4 rounded-2xl border bg-surface p-4 sm:p-5 ${isSelected ? 'border-primary ring-2 ring-primary' : 'border-line'} ${open || isSelected ? '' : 'opacity-80'}`}
            >
              <div className="flex items-start gap-4">
                {e.date && <DateTile date={e.date} />}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 text-lg leading-snug font-extrabold wrap-anywhere">{e.name}</h2>
                    <span
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${open ? 'bg-ok/10 text-ok-text' : 'bg-soft text-muted'}`}
                    >
                      <span className={`size-1.5 rounded-full ${open ? 'bg-ok-text' : 'bg-muted'}`} aria-hidden="true" />
                      {open ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <dl className="flex flex-col gap-1 text-sm text-muted">
                    {e.date && (
                      <Meta label="Date" icon={<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>}>
                        {fmtDate(e.date)}
                      </Meta>
                    )}
                    {e.venue && (
                      <Meta label="Venue" icon={<><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>}>
                        {e.venue}
                      </Meta>
                    )}
                    <Meta label="Tickets" icon={<><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v14" strokeDasharray="2 2" /></>}>
                        <strong className="font-semibold text-ink">{count.toLocaleString('en')} tickets</strong>, numbered {e.ticketFrom} to {e.ticketTo}
                    </Meta>
                  </dl>
                </div>
              </div>
              {e.details && <p className="text-[15px] leading-relaxed">{e.details}</p>}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin?event=${encodeURIComponent(e.name)}`}
                  className="flex h-10 items-center rounded-lg bg-primary px-4 text-[15px] font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover"
                >
                  Open desk
                </Link>
                <Link href={`/admin/tickets?event=${encodeURIComponent(e.name)}`} className={secondaryLink}>
                  Tickets
                </Link>
                <Link href={`/admin/qr?event=${encodeURIComponent(e.name)}`} className={secondaryLink}>
                  QR codes
                </Link>
                <Link href={`/admin/events?report=${encodeURIComponent(e.name)}#report`} className={secondaryLink}>
                  Report
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
