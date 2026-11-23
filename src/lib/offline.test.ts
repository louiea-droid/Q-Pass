import { expect, test } from 'vitest'
import { QUEUE_KEY, drain, enqueue, isNetworkError, readQueue } from './offline'

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
