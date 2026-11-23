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

/** One event: header with shortcuts, Edit and a ⋯ menu (close / reopen), then the report. */
export default async function EventPage({ params }: PageProps<'/admin/events/[name]'>) {
  await requireStaff('admin')
  const event = await getEvent(decode((await params).name))
  if (!event) notFound()
  const tickets = await listTickets(event.name)
  const q = encodeURIComponent(event.name)

  return (
    <section className="flex flex-col gap-6">
      <Link href="/admin/events" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 6-6 6 6 6" />
        </svg>
        All events
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {event.date && <DateTile date={event.date} />}
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="min-w-0 text-2xl leading-tight font-extrabold wrap-anywhere">{event.name}</h1>
              <StatusPill open={event.status === 'open'} />
            </div>
            <EventMeta event={event} inline />
            {event.details && <p className="max-w-prose text-[15px] leading-relaxed">{event.details}</p>}
          </div>
        </div>
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
          <EditEvent event={event} />
        </div>
      </header>

      <EventReport event={event} tickets={tickets} />
    </section>
  )
}
