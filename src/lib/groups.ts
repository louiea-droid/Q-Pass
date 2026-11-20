// A group (family) = the tickets in an event that carry the same name.

type T = { ticket: string; name: string; checkedInAt: string }

export const groupKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

export function groupCounts(tickets: T[]): Map<string, { total: number; here: number }> {
  const out = new Map<string, { total: number; here: number }>()
  for (const t of tickets) {
    const k = groupKey(t.name)
    if (!k) continue
    const g = out.get(k) ?? { total: 0, here: 0 }
    g.total++
    if (t.checkedInAt) g.here++
    out.set(k, g)
  }
  return out
}

const pad = (n: number) => String(n).padStart(4, '0')

/** Ticket numbers as typed by an admin: "12, 57 103" or "10-14" runs. Tickets are handed out at random. */
export function parseTicketList(text: string): { numbers: string[]; invalid: string[] } {
  const numbers: string[] = []
  const invalid: string[] = []
  for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
    const run = /^(\d{1,4})[-–](\d{1,4})$/.exec(token)
    const one = /^\d{1,4}$/.test(token)
    if (one) numbers.push(pad(Number(token)))
    else if (run && Number(run[1]) <= Number(run[2]))
      for (let n = Number(run[1]); n <= Number(run[2]); n++) numbers.push(pad(n))
    else invalid.push(token)
  }
  return { numbers: [...new Set(numbers)], invalid }
}

/** Which of `numbers` can go to `name`, and what's in the way. */
export function planGive(
  tickets: { ticket: string; name: string }[],
  numbers: string[],
  name: string,
): { tickets: string[]; taken: { ticket: string; name: string }[]; missing: string[] } {
  const byNumber = new Map(tickets.map((t) => [t.ticket, t]))
  return {
    tickets: numbers.filter((n) => byNumber.has(n)),
    taken: numbers
      .map((n) => byNumber.get(n))
      .filter((t): t is { ticket: string; name: string } => !!t && !!t.name.trim() && groupKey(t.name) !== groupKey(name))
      .map((t) => ({ ticket: t.ticket, name: t.name })),
    missing: numbers.filter((n) => !byNumber.has(n)),
  }
}
