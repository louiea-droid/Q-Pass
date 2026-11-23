import Link from 'next/link'
import { requireStaff } from '@/lib/guard'
import { pickableEvents } from '@/lib/display'
import { listEvents } from '@/lib/store'
import EventPicker from '../EventPicker'
import QrCodes from './QrCodes'

export default async function QrPage({ searchParams }: PageProps<'/admin/qr'>) {
  await requireStaff('admin')
  const { event: wanted } = await searchParams
  const events = await listEvents()
  if (events.length === 0)
    return (
      <section className="flex max-w-xl flex-col gap-3 pt-2">
        <h1 className="text-2xl font-extrabold">No QR codes yet</h1>
        <p className="text-[15px] text-muted">Create an event first. Its QR codes will be listed here.</p>
        <Link href="/admin/events" className="flex h-10 w-fit items-center rounded-lg bg-primary px-4 text-[15px] font-bold text-primary-ink hover:bg-primary-hover">
          Create an event
        </Link>
      </section>
    )
  const event = events.find((e) => e.name === wanted) ?? events.find((e) => e.status === 'open') ?? events[0]
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-extrabold">QR codes</h1>
          <p className="text-sm text-muted">
            {event.name}, tickets {event.ticketFrom} to {event.ticketTo}. Each image has its ticket number under the code.
          </p>
        </div>
        <EventPicker events={pickableEvents(events, event.name)} value={event.name} />
      </div>
      <QrCodes key={event.name} event={event.name} from={event.ticketFrom} to={event.ticketTo} />
    </>
  )
}
