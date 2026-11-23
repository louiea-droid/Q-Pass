import { normalizeTicket, parsePayload } from './qr'

/** A scan the phone couldn't send: kept in local storage and sent once the internet is back. `by` is who scanned it. */
export type QueuedScan = { id: string; event: string; method: 'QR' | 'manual'; value: string; at: string; by?: string }

export const QUEUE_KEY = 'qpass-offline-queue'

type Read = Pick<Storage, 'getItem'>
type ReadWrite = Pick<Storage, 'getItem' | 'setItem'>

export function readQueue(s: Read): QueuedScan[] {
  try {
    const q = JSON.parse(s.getItem(QUEUE_KEY) ?? '[]')
    return Array.isArray(q) ? q : []
  } catch {
    return []
  }
}

const save = (s: ReadWrite, q: QueuedScan[]) => s.setItem(QUEUE_KEY, JSON.stringify(q))

/** Adds a scan; null when the phone can't store it (storage full or blocked), so the caller can say so. */
export function enqueue(s: ReadWrite, scan: Omit<QueuedScan, 'id'>): QueuedScan[] | null {
  const q = [...readQueue(s), { ...scan, id: crypto.randomUUID() }]
  try {
    save(s, q)
    return q
  } catch {
    return null
  }
}

/**
 * Sends the oldest scan first. Each is removed only after it is sent; the first failure stops the run.
 * ponytail: a scan that fails for good (e.g. the app was redeployed mid-event and the old page's action is gone)
 * holds up the rest until the page is reloaded. Upgrade path: drop or set aside items after N non-network failures.
 */
export async function drain(s: ReadWrite, send: (q: QueuedScan) => Promise<void>): Promise<{ sent: number; left: number }> {
  let sent = 0
  for (;;) {
    const next = readQueue(s)[0]
    if (!next) break
    try {
      await send(next)
    } catch {
      break
    }
    // Re-read: scans may have been queued while this one was sending.
    save(s, readQueue(s).filter((x) => x.id !== next.id))
    sent++
  }
  return { sent, left: readQueue(s).length }
}

/** Offline, or the request never reached the server (Chrome: "Failed to fetch", Safari: "Load failed"). */
export function isNetworkError(e: unknown, online: boolean): boolean {
  return !online || /fetch|network|load failed|connection/i.test(String((e as Error)?.message ?? e))
}

/** Rejects with a network-style error if `p` takes longer than `ms`: on weak Wi-Fi a request can hang instead of failing. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout: no answer from the server')), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

const ticketOf = (s: Omit<QueuedScan, 'id'>) => {
  if (s.method === 'QR') return parsePayload(s.value)
  const ticket = normalizeTicket(s.value)
  return ticket ? { event: s.event, ticket } : null
}

/**
 * What the phone can tell on its own before saving a scan offline: not a ticket, another event's ticket,
 * or a ticket already saved offline for this event. Only 'ok' should be saved and waved in.
 */
export function checkOffline(queue: QueuedScan[], scan: Omit<QueuedScan, 'id'>): 'ok' | 'not_ticket' | 'wrong_event' | 'duplicate' {
  const t = ticketOf(scan)
  if (!t) return 'not_ticket'
  if (t.event !== scan.event) return 'wrong_event'
  return queue.some((q) => q.event === scan.event && ticketOf(q)?.ticket === t.ticket) ? 'duplicate' : 'ok'
}
