import type { EventInfo, ScanOutcome, Ticket } from './types'

type Update = Pick<Ticket, 'checkedInAt' | 'checkedInBy' | 'method'>

/** Spec rule order: not a ticket → wrong event → closed → not found → already in → check in. */
export function decideCheckIn(args: {
  scannedEvent: string | null
  event: EventInfo
  ticket: Ticket | undefined
  now: string
  staffName: string
  method: 'QR' | 'manual'
}): { outcome: ScanOutcome; update?: Update } {
  const { scannedEvent, event, ticket, now, staffName, method } = args
  if (scannedEvent === null) return { outcome: { result: 'not_found', message: 'Not a Q-Pass ticket' } }
  if (scannedEvent !== event.name)
    return { outcome: { result: 'wrong_event', message: `This ticket is for ${scannedEvent}` } }
  if (event.status === 'closed') return { outcome: { result: 'event_closed', message: 'This event is closed' } }
  if (!ticket) return { outcome: { result: 'not_found', message: 'Ticket not found for this event' } }

  const who = { ticket: ticket.ticket, name: ticket.name || undefined }
  if (ticket.checkedInAt)
    return {
      outcome: {
        ...who, result: 'already_checked_in', message: 'Already checked in',
        checkedInAt: ticket.checkedInAt, checkedInBy: ticket.checkedInBy,
      },
    }
  return {
    outcome: { ...who, result: 'checked_in', message: ticket.name || `Ticket ${ticket.ticket} — no name` },
    update: { checkedInAt: now, checkedInBy: staffName, method },
  }
}
