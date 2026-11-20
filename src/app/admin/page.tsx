import Link from 'next/link'
import { requireStaff } from '@/lib/guard'
import { listEvents, listTickets } from '@/lib/store'
import Desk from './Desk'
import EventPicker from './EventPicker'

export const metadata = { title: 'Check-in desk · Q-Pass' }

export default async function CheckInDesk({ searchParams }: PageProps<'/admin'>) {
  await requireStaff('admin')
  const { event: wanted } = await searchParams
  const events = await listEvents()
  if (events.length === 0)
    return (
      <section className="flex max-w-xl flex-col gap-3 pt-6">
        <h1 className="text-3xl font-extrabold">Welcome! Let’s set up your first event</h1>
        <p className="text-[17px] text-muted">Create the event to get its ticket list and QR codes.</p>
        <Link
          href="/admin/events"
          className="mt-2 flex h-12 w-fit items-center rounded-2xl bg-primary px-5 font-bold text-primary-ink hover:bg-primary-hover"
        >
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
          <h1 className="text-2xl font-extrabold wrap-anywhere">{event.name}</h1>
          <p className="text-sm text-muted">
            {[event.venue, event.status === 'open' ? 'open for scanning' : 'closed, so changes are off'].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <EventPicker events={events.map((e) => e.name)} value={event.name} />
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
      <Desk key={event.name} event={event.name} tickets={tickets} readOnly={event.status === 'closed'} />
    </>
  )
}
