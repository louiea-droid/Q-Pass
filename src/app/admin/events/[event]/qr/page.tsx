import { requireStaff } from '@/lib/guard'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEvent } from '@/lib/store'
import QrSheet from './QrSheet'

export const metadata = { title: 'Print QR codes · TAC Check-in' }

export default async function QrPage({ params }: PageProps<'/admin/events/[event]/qr'>) {
  await requireStaff('admin')
  const name = decodeURIComponent((await params).event)
  const event = await getEvent(name)
  if (!event) notFound()
  return (
    <section>
      <div className="no-print">
        <Link href="/admin/events" className="text-sm text-muted underline">
          Back to events
        </Link>
        <h1 className="mt-2 text-3xl font-semibold wrap-anywhere">QR codes for {event.name}</h1>
        <p className="mt-2 max-w-prose text-muted">
          Each code is about 3 cm with its ticket number under it, 35 to an A4 page. Print, cut along the dashed lines, and
          attach each one to the ticket with the same number.
        </p>
      </div>
      <QrSheet event={event.name} from={event.ticketFrom} to={event.ticketTo} />
    </section>
  )
}
