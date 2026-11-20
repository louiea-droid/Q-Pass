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

/** First ticket that starts `count` consecutive tickets with no name, or null. */
export function firstFreeRun(tickets: { ticket: string; name: string }[], count: number): string | null {
  const free = new Set(tickets.filter((t) => !t.name.trim()).map((t) => Number(t.ticket)))
  const sorted = [...free].sort((a, b) => a - b)
  for (const start of sorted) {
    let ok = true
    for (let i = 1; i < count && ok; i++) ok = free.has(start + i)
    if (ok) return pad(start)
  }
  return null
}

/** Which tickets "give `count` tickets from `start` to `name`" touches, and what's in the way. */
export function planGive(
  tickets: { ticket: string; name: string }[],
  start: string,
  count: number,
  name: string,
): { tickets: string[]; taken: { ticket: string; name: string }[]; missing: string[] } {
  const byNumber = new Map(tickets.map((t) => [t.ticket, t]))
  const wanted = Array.from({ length: count }, (_, i) => pad(Number(start) + i))
  return {
    tickets: wanted.filter((n) => byNumber.has(n)),
    taken: wanted
      .map((n) => byNumber.get(n))
      .filter((t): t is { ticket: string; name: string } => !!t && !!t.name.trim() && groupKey(t.name) !== groupKey(name))
      .map((t) => ({ ticket: t.ticket, name: t.name })),
    missing: wanted.filter((n) => !byNumber.has(n)),
  }
}
