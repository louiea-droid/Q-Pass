import type { EventInfo } from '@/lib/types'

// Pieces shared by the events list and an event's own page.

export const eventHref = (name: string) => `/admin/events/${encodeURIComponent(name)}`

export const fmtDate = (d: string) =>
  d ? new Date(`${d}T00:00`).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''

export const secondaryLink =
  'flex h-10 items-center rounded-lg border border-line-strong px-3.5 text-[15px] font-semibold transition-colors duration-200 hover:bg-soft'

/** Calendar-style date block, so events can be told apart at a glance. */
export function DateTile({ date }: { date: string }) {
  const d = new Date(`${date}T00:00`)
  if (isNaN(d.getTime())) return null
  return (
    <div aria-hidden="true" className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-line bg-paper">
      <span className="w-full bg-primary py-0.5 text-center text-xs font-bold text-primary-ink">
        {d.toLocaleDateString('en', { month: 'short' })}
      </span>
      <span className="pt-1 text-2xl leading-none font-extrabold tabular-nums">{d.getDate()}</span>
      <span className="pb-1.5 text-[11px] font-semibold text-muted">{d.getFullYear()}</span>
    </div>
  )
}

export function StatusPill({ open }: { open: boolean }) {
  return (
    <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${open ? 'bg-ok/10 text-ok-text' : 'bg-soft text-muted'}`}>
      <span className={`size-1.5 rounded-full ${open ? 'bg-ok-text' : 'bg-muted'}`} aria-hidden="true" />
      {open ? 'Open' : 'Closed'}
    </span>
  )
}

function Meta({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="sr-only">{label}</dt>
      <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon}
      </svg>
      <dd className="min-w-0 wrap-anywhere">{children}</dd>
    </div>
  )
}

/** Date, venue and ticket range: stacked on the list cards, in one wrapping row on an event's page. */
export function EventMeta({ event: e, inline = false }: { event: EventInfo; inline?: boolean }) {
  const count = Number(e.ticketTo) - Number(e.ticketFrom) + 1
  return (
    <dl className={`text-sm text-muted ${inline ? 'flex flex-wrap gap-x-5 gap-y-1' : 'flex flex-col gap-1'}`}>
      {e.date && (
        <Meta label="Date" icon={<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>}>
          {fmtDate(e.date)}
        </Meta>
      )}
      {e.venue && (
        <Meta label="Venue" icon={<><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>}>
          {e.venue}
        </Meta>
      )}
      <Meta label="Tickets" icon={<><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v14" strokeDasharray="2 2" /></>}>
        <strong className="font-semibold text-ink">{count.toLocaleString('en')} tickets</strong>, numbered {e.ticketFrom} to {e.ticketTo}
      </Meta>
    </dl>
  )
}
