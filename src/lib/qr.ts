const RESERVED = ['staff', 'events', 'log']

/** Most tickets one event can have: they are all created (and their QR codes zipped) in one go. */
export const MAX_TICKETS = 10_000

/** Any whole number up to 9 digits, at least 4 digits long: 57 → "0057", 012345 → "12345". */
export function normalizeTicket(v: string | number): string | null {
  const s = String(v).trim()
  return /^\d{1,9}$/.test(s) ? String(Number(s)).padStart(4, '0') : null
}

export const makePayload = (event: string, ticket: string) => `${event}-${ticket}`

export function parsePayload(text: string): { event: string; ticket: string } | null {
  const i = text.lastIndexOf('-')
  if (i <= 0) return null
  const event = text.slice(0, i)
  const ticket = text.slice(i + 1)
  return /^\d{4,9}$/.test(ticket) && isValidEventName(event) ? { event, ticket: normalizeTicket(ticket)! } : null
}

export function isValidEventName(name: string): boolean {
  return /^[A-Za-z0-9 -]{1,40}$/.test(name) && name.trim() === name && !RESERVED.includes(name.toLowerCase())
}

export function ticketRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let n = Number(from); n <= Number(to); n++) out.push(String(n).padStart(4, '0'))
  return out
}
