import { requireStaff } from '@/lib/guard'
import Link from 'next/link'
import { listEvents } from '@/lib/store'
import { CreateEventForm, EditEvent } from './EventForm'

export const metadata = { title: 'Events · Q-Pass' }

export default async function EventsPage() {
  await requireStaff('admin')
  const events = await listEvents()
  return (
    <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div>
        <h1 className="text-3xl font-extrabold">Events</h1>
        {events.length === 0 ? (
          <p className="mt-3 text-muted">No events yet. Create one to get its ticket list and QR codes.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {events.map((e) => (
              <li key={e.name} className="rounded-3xl border border-line bg-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-extrabold wrap-anywhere">{e.name}</h2>
                    <p className="text-sm text-muted">
                      Tickets {e.ticketFrom} to {e.ticketTo}
                      {e.status === 'closed' ? ', closed' : ', open for scanning'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/events/${encodeURIComponent(e.name)}/qr`}
                      className="rounded-xl bg-primary h-10 px-3.5 text-sm font-semibold text-primary-ink"
                    >
                      Print QR codes
                    </Link>
                    <Link
                      href={`/admin?event=${encodeURIComponent(e.name)}`}
                      className="rounded-xl border border-line h-10 px-3.5 text-sm"
                    >
                      Open desk
                    </Link>
                  </div>
                </div>
                <EditEvent event={e} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <CreateEventForm />
    </section>
  )
}
