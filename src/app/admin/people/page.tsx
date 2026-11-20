import Link from 'next/link'
import { listEvents, listTickets } from '@/lib/store'
import EventPicker from '../EventPicker'
import PeopleTable from './PeopleTable'

export const metadata = { title: 'People · TAC Check-in' }

export default async function PeoplePage({ searchParams }: PageProps<'/admin/people'>) {
  const { event: wanted } = await searchParams
  const events = await listEvents()
  if (events.length === 0)
    return (
      <section>
        <h1 className="font-serif text-3xl font-semibold">No events yet</h1>
        <Link href="/admin/events" className="mt-4 inline-block rounded-lg bg-pine px-4 py-2 font-semibold text-pine-ink">
          Create an event
        </Link>
      </section>
    )
  const event = events.find((e) => e.name === wanted) ?? events.find((e) => e.status === 'open') ?? events[0]
  const tickets = await listTickets(event.name)
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">People</h1>
        <EventPicker events={events.map((e) => e.name)} value={event.name} />
      </div>
      {event.status === 'closed' && (
        <p className="mt-3 rounded-md border border-line bg-surface p-3 text-sm">
          This event is closed, so the list is read-only. Reopen it on the Events page to make changes.
        </p>
      )}
      <PeopleTable key={event.name} event={event.name} tickets={tickets} readOnly={event.status === 'closed'} />
    </section>
  )
}
