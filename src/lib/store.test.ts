import { beforeEach, expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Fake Apps Script web app: answers the ops store.ts sends.
type Call = { op: string; args: Record<string, unknown> }
let calls: Call[] = []
let handlers: Record<string, (args: Record<string, unknown>) => unknown> = {}

beforeEach(() => {
  vi.resetModules()
  process.env.APPS_SCRIPT_URL = 'https://script.example/exec'
  process.env.APPS_SCRIPT_SECRET = 's3cret'
  calls = []
  handlers = {
    read: ({ range }) => (range === 'Events!A2:G' ? [['TAC Gala', '', '', '', '0000', '1000', 'open']] : []),
    append: () => null,
    addSheet: () => null,
    write: () => null,
  }
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const { op, args, secret } = JSON.parse(init.body)
    calls.push({ op, args })
    if (secret !== 's3cret') return new Response(JSON.stringify({ ok: false, error: 'Wrong secret' }))
    try {
      return new Response(JSON.stringify({ ok: true, data: handlers[op]!(args) }))
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: (e as Error).message }))
    }
  })
})

const staff = { name: 'Maria', role: 'scanner' as const }

test('first scan of a ticket is checked in in one locked script call', async () => {
  handlers.checkIn = () => ['0001', 'Juan', '', '', '', '', '']
  const { checkIn } = await import('./store')
  const r = await checkIn({ payload: 'TAC Gala-0001', event: 'TAC Gala', staff, method: 'QR' })
  expect(r).toMatchObject({ result: 'checked_in', name: 'Juan', ticket: '0001' })
  const call = calls.find((c) => c.op === 'checkIn')!
  expect(call.args).toMatchObject({ event: 'TAC Gala', ticket: '0001', staffName: 'Maria', staffRole: 'scanner', method: 'QR' })
})

test('scan of a used ticket reports when and by whom, from the row before the scan', async () => {
  handlers.checkIn = () => ['0001', 'Juan', '', '', '2026-11-26T08:00:00.000Z', 'Ana', 'QR']
  const { checkIn } = await import('./store')
  const r = await checkIn({ payload: 'TAC Gala-0001', event: 'TAC Gala', staff, method: 'QR' })
  expect(r).toMatchObject({ result: 'already_checked_in', checkedInAt: '2026-11-26T08:00:00.000Z', checkedInBy: 'Ana' })
})

test('ticket missing from the event tab is not_found', async () => {
  handlers.checkIn = () => null
  const { checkIn } = await import('./store')
  const r = await checkIn({ payload: null, event: 'TAC Gala', ticket: '0999', staff, method: 'manual' })
  expect(r.result).toBe('not_found')
})

test('a rejected scan still answers the scanner when the Log write fails', async () => {
  handlers.append = () => {
    throw new Error('Service invoked too many times')
  }
  const { checkIn } = await import('./store')
  const r = await checkIn({ payload: 'Old Gala-0001', event: 'TAC Gala', staff, method: 'QR' })
  expect(r.result).toBe('wrong_event')
  expect(calls.some((c) => c.op === 'checkIn')).toBe(false)
})

test('a new event tab is created with enough rows for every ticket', async () => {
  handlers.read = () => []
  const { createEvent } = await import('./store')
  await createEvent({ name: 'New Event', date: '', venue: '', details: '', ticketFrom: '0000', ticketTo: '1000', status: 'open' })
  const add = calls.find((c) => c.op === 'addSheet')!
  expect(add.args.rowCount).toBeGreaterThanOrEqual(1002)
})

test('script errors surface their message', async () => {
  process.env.APPS_SCRIPT_SECRET = 'wrong'
  const { listEvents } = await import('./store')
  await expect(listEvents()).rejects.toThrow('Wrong secret')
})
