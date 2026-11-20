const RESERVED = ['staff', 'events', 'log']

export function normalizeTicket(v: string | number): string | null {
  const s = String(v).trim()
  return /^\d{1,4}$/.test(s) ? s.padStart(4, '0') : null
}

export const makePayload = (event: string, ticket: string) => `${event}-${ticket}`

export function parsePayload(text: string): { event: string; ticket: string } | null {
  const i = text.lastIndexOf('-')
  if (i <= 0) return null
  const event = text.slice(0, i)
  const ticket = text.slice(i + 1)
  return /^\d{4}$/.test(ticket) && isValidEventName(event) ? { event, ticket } : null
}

export function isValidEventName(name: string): boolean {
  return /^[A-Za-z0-9 -]{1,40}$/.test(name) && name.trim() === name && !RESERVED.includes(name.toLowerCase())
}

export function ticketRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let n = Number(from); n <= Number(to); n++) out.push(String(n).padStart(4, '0'))
  return out
}
