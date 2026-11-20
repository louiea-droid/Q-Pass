/** Names are optional: the ticket number stands in as the headline when there is none. */
export const headline = (t: { ticket?: string; name?: string }) => t.name?.trim() || `Ticket ${t.ticket ?? ''}`.trim()

/** Handing out a ticket = writing a name on it. */
export const isGiven = (t: { name: string }) => t.name.trim() !== ''

export type TicketFilter = 'all' | 'given' | 'notgiven' | 'in' | 'out'

export function matchTicket(
  t: { ticket: string; name: string; info: string; checkedInAt: string },
  query: string,
  filter: TicketFilter,
): boolean {
  if (filter === 'given' && !isGiven(t)) return false
  if (filter === 'notgiven' && isGiven(t)) return false
  if (filter === 'in' && !t.checkedInAt) return false
  if (filter === 'out' && t.checkedInAt) return false
  const q = query.trim().toLowerCase()
  return !q || t.ticket.includes(q) || t.name.toLowerCase().includes(q) || t.info.toLowerCase().includes(q)
}

/** The desk's headline numbers, from the ticket list (the live refresh then keeps them current). */
export function arrivalCounts(tickets: { name: string; checkedInAt: string }[]) {
  const named = tickets.filter(isGiven)
  return {
    total: tickets.length,
    named: named.length,
    namedCheckedIn: named.filter((t) => t.checkedInAt).length,
    checkedIn: tickets.filter((t) => t.checkedInAt).length,
  }
}
