import { requireStaff } from '@/lib/guard'
import Link from 'next/link'
import { listEvents } from '@/lib/store'
import Dashboard from './Dashboard'
import EventPicker from './EventPicker'

export const metadata = { title: 'Dashboard · TAC Check-in' }

export default async function AdminHome({ searchParams }: PageProps<'/admin'>) {
  await requireStaff('admin')
  const { event: wanted } = await searchParams
  const events = await listEvents()
  if (events.length === 0)
    return (
      <section>
        <h1 className="font-serif text-3xl font-semibold">No events yet</h1>
        <p className="mt-2 text-muted">Create your first event to get its ticket list and QR codes.</p>
        <Link href="/admin/events" className="mt-4 inline-block rounded-lg bg-pine px-4 py-2 font-semibold text-pine-ink">
          Create an event
        </Link>
      </section>
    )
  const event =
    events.find((e) => e.name === wanted)?.name ?? (events.find((e) => e.status === 'open') ?? events[0]).name
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">Check-in</h1>
        <EventPicker events={events.map((e) => e.name)} value={event} />
      </div>
      <Dashboard key={event} event={event} />
    </section>
  )
}
