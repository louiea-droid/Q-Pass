import Link from 'next/link'
import { requireStaff } from '@/lib/guard'
import { listEvents, listTickets } from '@/lib/store'
import EventPicker from '../EventPicker'
import ImportGuests from './ImportGuests'
import TicketsTable from './TicketsTable'

export const metadata = { title: 'Tickets · Q-Pass' }

export default async function TicketsPage({ searchParams }: PageProps<'/admin/tickets'>) {
  await requireStaff('admin')
  const { event: wanted } = await searchParams
  const events = await listEvents()
  if (events.length === 0)
    return (
      <section className="flex max-w-xl flex-col gap-3 pt-2">
        <h1 className="text-2xl font-extrabold">No tickets yet</h1>
        <p className="text-[15px] text-muted">Create an event first. Its tickets will be listed here.</p>
        <Link href="/admin/events" className="flex h-10 w-fit items-center rounded-lg bg-primary px-4 text-[15px] font-bold text-primary-ink hover:bg-primary-hover">
          Create an event
        </Link>
      </section>
    )
  const event = events.find((e) => e.name === wanted) ?? events.find((e) => e.status === 'open') ?? events[0]
  const tickets = await listTickets(event.name)
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-extrabold">Tickets</h1>
          <p className="text-sm text-muted">
            {event.name}. Click a box to type. Adding a name marks the ticket as given.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <EventPicker events={events.map((e) => e.name)} value={event.name} />
          <ImportGuests event={event.name} closed={event.status === 'closed'} />
          <a
            href={`/api/export?event=${encodeURIComponent(event.name)}`}
            className="flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] font-semibold transition-colors duration-200 hover:bg-soft"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            Download list
          </a>
        </div>
      </div>
      <TicketsTable key={event.name} event={event.name} tickets={tickets} readOnly={event.status === 'closed'} />
    </>
  )
}
