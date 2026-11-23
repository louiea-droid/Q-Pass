import { expect, test, vi } from 'vitest'
import { QUEUE_KEY, checkOffline, drain, enqueue, isNetworkError, readQueue, withTimeout } from './offline'

const fakeStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const scan = (value: string) => ({ event: 'TAC Gala', method: 'QR' as const, value, at: '2027-01-03T10:00:00Z' })

test('readQueue gives an empty queue for a missing key or bad JSON', () => {
  const s = fakeStorage()
  expect(readQueue(s)).toEqual([])
  s.setItem(QUEUE_KEY, 'not json')
  expect(readQueue(s)).toEqual([])
})

test('enqueue keeps scans in order with distinct ids', () => {
  const s = fakeStorage()
  enqueue(s, scan('a'))
  enqueue(s, scan('b'))
  const q = readQueue(s)
  expect(q.map((x) => x.value)).toEqual(['a', 'b'])
  expect(q[0].id).not.toBe(q[1].id)
})

test('drain sends everything and empties the queue', async () => {
  const s = fakeStorage()
  enqueue(s, scan('a'))
  enqueue(s, scan('b'))
  const sent: string[] = []
  expect(await drain(s, async (q) => void sent.push(q.value))).toEqual({ sent: 2, left: 0 })
  expect(sent).toEqual(['a', 'b'])
  expect(readQueue(s)).toEqual([])
})

test('drain stops at the first failure and keeps it and the rest, in order', async () => {
  const s = fakeStorage()
  for (const v of ['a', 'b', 'c']) enqueue(s, scan(v))
  const result = await drain(s, async (q) => {
    if (q.value === 'b') throw new TypeError('Failed to fetch')
  })
  expect(result).toEqual({ sent: 1, left: 2 })
  expect(readQueue(s).map((x) => x.value)).toEqual(['b', 'c'])
})

test('a scan queued while draining is kept', async () => {
  const s = fakeStorage()
  enqueue(s, scan('a'))
  const sent: string[] = []
  await drain(s, async (q) => {
    sent.push(q.value)
    if (q.value === 'a') enqueue(s, scan('new'))
  })
  // 'new' was queued mid-run and not lost: it went out in the same run, after 'a'.
  expect(sent).toEqual(['a', 'new'])
  expect(readQueue(s)).toEqual([])
})

test('isNetworkError: offline, or a failed request (Chrome and Safari wording); not a server error', () => {
  expect(isNetworkError(new Error('x'), false)).toBe(true)
  expect(isNetworkError(new TypeError('Failed to fetch'), true)).toBe(true)
  expect(isNetworkError(new Error('Load failed'), true)).toBe(true)
  expect(isNetworkError(new Error('Event not found'), true)).toBe(false)
})

test('withTimeout: a request that hangs fails as a network error, so the scan is saved offline', async () => {
  vi.useFakeTimers()
  try {
    const p = withTimeout(new Promise(() => {}), 8000)
    const caught = p.catch((e) => e)
    vi.advanceTimersByTime(8000)
    expect(isNetworkError(await caught, true)).toBe(true)
  } finally {
    vi.useRealTimers()
  }
})

test('withTimeout: a quick answer passes through', async () => {
  expect(await withTimeout(Promise.resolve(7), 8000)).toBe(7)
})

test('checkOffline: the phone stops codes it already knows are wrong, and a ticket scanned twice offline', () => {
  const qr = (value: string) => ({ event: 'TAC Gala', method: 'QR' as const, value, at: '' })
  const typed = (value: string) => ({ event: 'TAC Gala', method: 'manual' as const, value, at: '' })
  const queued = [{ ...qr('TAC Gala-0057'), id: '1' }]
  expect(checkOffline([], qr('TAC Gala-0058'))).toBe('ok')
  expect(checkOffline([], qr('https://example.com/poster'))).toBe('not_ticket')
  expect(checkOffline([], qr('Youth Camp-0058'))).toBe('wrong_event')
  expect(checkOffline([], typed('abc'))).toBe('not_ticket')
  expect(checkOffline(queued, qr('TAC Gala-0057'))).toBe('duplicate')
  expect(checkOffline(queued, typed('57'))).toBe('duplicate')
})

test('enqueue: when the phone storage is full it reports failure instead of losing the scan silently', () => {
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } }
  expect(enqueue(full, scan('a'))).toBeNull()
})
