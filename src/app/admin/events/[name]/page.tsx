import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/guard'
import { getEvent, listTickets } from '@/lib/store'
import { EditEvent } from '../EventForm'
import EventReport from '../EventReport'
import { DateTile, EventMeta, StatusPill } from '../parts'

const rowLink =
  'flex h-9 shrink-0 items-center rounded-lg border border-line-strong px-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-200 hover:bg-soft sm:h-10 sm:px-3.5 sm:text-[15px]'

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

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
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
        {/* One row at every width: smaller buttons on phones; on very narrow screens the row scrolls sideways (padding keeps focus rings visible). */}
        <div className="-m-1 flex max-w-[calc(100%+0.5rem)] gap-1.5 overflow-x-auto p-1 [scrollbar-width:none] sm:gap-2 lg:max-w-none lg:shrink-0 lg:overflow-visible">
          <Link
            href={`/admin?event=${q}`}
            className="flex h-9 shrink-0 items-center rounded-lg bg-primary px-2.5 text-[13px] font-bold whitespace-nowrap text-primary-ink transition-colors duration-200 hover:bg-primary-hover sm:h-10 sm:px-4 sm:text-[15px]"
          >
            Open desk
          </Link>
          <Link href={`/admin/tickets?event=${q}`} className={rowLink}>
            Tickets
          </Link>
          <Link href={`/admin/qr?event=${q}`} className={rowLink}>
            QR codes
          </Link>
          <EditEvent event={event} tickets={tickets.length} checkedIn={tickets.filter((t) => t.checkedInAt).length} />
        </div>
      </header>

      <EventReport event={event} tickets={tickets} />
    </section>
  )
}
