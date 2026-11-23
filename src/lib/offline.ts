/** A scan the phone couldn't send: kept in local storage and sent once the internet is back. */
export type QueuedScan = { id: string; event: string; method: 'QR' | 'manual'; value: string; at: string }

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

export function enqueue(s: ReadWrite, scan: Omit<QueuedScan, 'id'>): QueuedScan[] {
  const q = [...readQueue(s), { ...scan, id: crypto.randomUUID() }]
  save(s, q)
  return q
}

/** Sends the oldest scan first. Each is removed only after it is sent; the first failure stops the run. */
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
