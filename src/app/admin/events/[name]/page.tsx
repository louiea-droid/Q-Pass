import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/guard'
import { getEvent, listTickets } from '@/lib/store'
import { EditEvent } from '../EventForm'
import EventReport from '../EventReport'
import { DateTile, EventMeta, StatusPill, secondaryLink } from '../parts'

const decode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export async function generateMetadata({ params }: PageProps<'/admin/events/[name]'>) {
  return { title: `${decode((await params).name)} · Q-Pass` }
}

/** One event: its details, shortcuts, report, and the edit / close controls. */
export default async function EventPage({ params }: PageProps<'/admin/events/[name]'>) {
  await requireStaff('admin')
  const event = await getEvent(decode((await params).name))
  if (!event) notFound()
  const tickets = await listTickets(event.name)
  const q = encodeURIComponent(event.name)
  const open = event.status === 'open'

  return (
    <section className="flex flex-col gap-5">
      <Link href="/admin/events" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 6-6 6 6 6" />
        </svg>
        All events
      </Link>

      <header className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {event.date && <DateTile date={event.date} />}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="min-w-0 text-2xl leading-tight font-extrabold wrap-anywhere">{event.name}</h1>
              <StatusPill open={open} />
            </div>
            <EventMeta event={event} />
          </div>
        </div>
        {event.details && <p className="text-[15px] leading-relaxed">{event.details}</p>}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin?event=${q}`}
            className="flex h-10 items-center rounded-lg bg-primary px-4 text-[15px] font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover"
          >
            Open desk
          </Link>
          <Link href={`/admin/tickets?event=${q}`} className={secondaryLink}>
            Tickets
          </Link>
          <Link href={`/admin/qr?event=${q}`} className={secondaryLink}>
            QR codes
          </Link>
        </div>
        <EditEvent event={event} />
      </header>

      <EventReport event={event} tickets={tickets} />
    </section>
  )
}
