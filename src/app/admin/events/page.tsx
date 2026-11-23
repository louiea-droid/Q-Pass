import Link from 'next/link'
import { requireStaff } from '@/lib/guard'
import { listEvents } from '@/lib/store'
import { NewEvent } from './EventForm'
import { DateTile, EventMeta, StatusPill, eventHref } from './parts'

export const metadata = { title: 'Events · Q-Pass' }

const STEPS = ['Create the event', 'Download the QR codes', 'Scan them at the door']

export default async function EventsPage() {
  await requireStaff('admin')
  const events = await listEvents()

  if (events.length === 0)
    return (
      <section className="mx-auto flex w-full max-w-xl flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold">Create your first event</h1>
          <p className="text-[15px] text-muted">It takes a minute. Then you can download the QR codes for the tickets.</p>
        </div>
        <ol className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${i === 0 ? 'bg-primary text-primary-ink' : 'bg-soft text-muted'}`}>
                {i + 1}
              </span>
              <span className={`font-semibold ${i === 0 ? '' : 'text-muted'}`}>{s}</span>
            </li>
          ))}
        </ol>
        <NewEvent startOpen />
      </section>
    )

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">Events</h1>
        <p className="text-sm text-muted">Pick an event to see its details, report and settings.</p>
      </div>
      <NewEvent />
      <ul className="grid gap-4 lg:grid-cols-2">
        {events.map((e) => {
          const open = e.status === 'open'
          return (
            <li key={e.name}>
              {/* The whole card opens the event's page. */}
              <Link
                href={eventHref(e.name)}
                className={`group flex h-full items-start gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors duration-200 hover:border-line-strong hover:bg-soft/40 sm:p-5 ${open ? '' : 'opacity-80'}`}
              >
                {e.date && <DateTile date={e.date} />}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 text-lg leading-snug font-extrabold wrap-anywhere group-hover:underline">{e.name}</h2>
                    <StatusPill open={open} />
                  </div>
                  <EventMeta event={e} />
                </div>
                <svg className="mt-1 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
