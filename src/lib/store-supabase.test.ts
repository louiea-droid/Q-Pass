import { beforeEach, expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Fake Supabase REST API (PostgREST): records requests, answers from in-memory tables.
type Req = { method: string; path: string; query: URLSearchParams; body: unknown; headers: Record<string, string> }
let reqs: Req[] = []
let tickets: Record<string, unknown>[] = []
let rpc: Record<string, (body: Record<string, unknown>) => unknown> = {}
let failLog = false
let eventsRows: Record<string, unknown>[] = []

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = 'https://proj.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  reqs = []
  failLog = false
  eventsRows = [{ name: 'TAC Gala', date: '', venue: '', details: '', ticket_from: '0000', ticket_to: '1000', status: 'open' }]
  tickets = []
  rpc = {}
  vi.stubGlobal('fetch', async (input: string, init: { method?: string; body?: string; headers?: Record<string, string> }) => {
    const u = new URL(input)
    const path = u.pathname.replace('/rest/v1/', '')
    const req = { method: init.method ?? 'GET', path, query: u.searchParams, body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers ?? {} }
    reqs.push(req)
    if (req.headers.apikey !== 'service-key') return json({ message: 'Invalid API key' }, 401)
    if (path.startsWith('rpc/')) return json(rpc[path.slice(4)]!(req.body as Record<string, unknown>))
    if (path === 'log') return failLog ? json({ message: 'boom' }, 500) : json(undefined, 201)
    if (path === 'events' && req.method === 'GET') return json(eventsRows)
    if (path === 'events' && req.method === 'POST') {
      const row = req.body as { name: string }
      if (eventsRows.some((e) => e.name === row.name)) return json({ code: '23505', message: 'duplicate key' }, 409)
      eventsRows.push(row)
      return json(undefined, 201)
    }
    if (path === 'tickets' && req.method === 'POST') {
      tickets.push(...(req.body as Record<string, unknown>[]))
      return json(undefined, 201)
    }
    if (path === 'tickets' && req.method === 'GET') {
      const [from, to] = (req.headers.Range ?? '0-999').split('-').map(Number)
      const page = tickets.slice(from, Math.min(to, from + 999) + 1) // server caps pages at 1,000 rows
      return json(page, 200, { 'Content-Range': `${from}-${from + page.length - 1}/${tickets.length}` })
    }
    return json(undefined, 204)
  })
})

const staff = { name: 'Maria', role: 'scanner' as const }
const row = (ticket: string, extra: Record<string, unknown> = {}) => ({
  event: 'TAC Gala', ticket, name: '', info: '', notes: '', checked_in_at: null, checked_in_by: '', method: '', ...extra,
})

test('first scan is checked in through the atomic check_in function', async () => {
  rpc.check_in = () => row('0001', { name: 'Juan' })
  const { checkIn } = await import('./store-supabase')
  const r = await checkIn({ payload: 'TAC Gala-0001', event: 'TAC Gala', staff, method: 'QR' })
  expect(r).toMatchObject({ result: 'checked_in', name: 'Juan', ticket: '0001' })
  expect(reqs.find((q) => q.path === 'rpc/check_in')!.body).toEqual({
    p_event: 'TAC Gala', p_ticket: '0001', p_staff_name: 'Maria', p_staff_role: 'scanner', p_method: 'QR',
  })
})

test('scan of a used ticket reports the original time and staff', async () => {
  rpc.check_in = () => row('0001', { name: 'Juan', checked_in_at: '2026-11-26T08:00:00+00:00', checked_in_by: 'Ana', method: 'QR' })
  const { checkIn } = await import('./store-supabase')
  const r = await checkIn({ payload: 'TAC Gala-0001', event: 'TAC Gala', staff, method: 'QR' })
  expect(r).toMatchObject({ result: 'already_checked_in', checkedInAt: '2026-11-26T08:00:00+00:00', checkedInBy: 'Ana' })
})

test('unknown ticket is not_found', async () => {
  rpc.check_in = () => null
  const { checkIn } = await import('./store-supabase')
  const r = await checkIn({ payload: null, event: 'TAC Gala', ticket: '0999', staff, method: 'manual' })
  expect(r.result).toBe('not_found')
})

test('a rejected scan is answered without check_in, even if the log write fails', async () => {
  failLog = true
  const { checkIn } = await import('./store-supabase')
  const r = await checkIn({ payload: 'Old Gala-0001', event: 'TAC Gala', staff, method: 'QR' })
  expect(r.result).toBe('wrong_event')
  expect(reqs.some((q) => q.path === 'rpc/check_in')).toBe(false)
})

test('creating an event inserts the event and every ticket; listing reads past the 1,000-row page limit', async () => {
  const { createEvent, listTickets } = await import('./store-supabase')
  await createEvent({ name: 'New Event', date: '', venue: '', details: '', ticketFrom: '0000', ticketTo: '1000', status: 'open' })
  expect(tickets).toHaveLength(1001)
  expect(tickets[57]).toMatchObject({ event: 'New Event', ticket: '0057' })
  const listed = await listTickets('New Event')
  expect(listed).toHaveLength(1001)
  expect(listed[1000].ticket).toBe('1000')
})

test('duplicate event names get a friendly message', async () => {
  const { createEvent } = await import('./store-supabase')
  await expect(
    createEvent({ name: 'TAC Gala', date: '', venue: '', details: '', ticketFrom: '0000', ticketTo: '0001', status: 'open' }),
  ).rejects.toThrow('An event with that name already exists.')
})

test('a wrong key surfaces a clear error', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'wrong'
  const { listEvents } = await import('./store-supabase')
  await expect(listEvents()).rejects.toThrow('Invalid API key')
})

test('a down or paused project (plain-text error page) says so instead of a JSON parse error', async () => {
  vi.stubGlobal('fetch', async () => new Response('Internal server error.', { status: 555 }))
  const { listEvents } = await import('./store-supabase')
  await expect(listEvents()).rejects.toThrow(/Supabase isn’t responding \(error 555\)/)
})

test('new sb_secret_ keys go only in the apikey header; legacy JWT keys also as Bearer', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_abc'
  let { listEvents } = await import('./store-supabase')
  await listEvents().catch(() => {})
  expect(reqs.at(-1)!.headers.Authorization).toBeUndefined()
  vi.resetModules()
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  ;({ listEvents } = await import('./store-supabase'))
  await listEvents()
  expect(reqs.at(-1)!.headers.Authorization).toBe('Bearer service-key')
})

test('SUPABASE_URL copied with /rest/v1/ on the end still works', async () => {
  process.env.SUPABASE_URL = 'https://proj.supabase.co/rest/v1/'
  const { listEvents } = await import('./store-supabase')
  await listEvents()
  expect(reqs.at(-1)!.path).toBe('events')
})

test('a check-in for someone holding several tickets reports how many of the group are here', async () => {
  rpc.check_in = () => row('0001', { name: 'Juan' })
  tickets = [
    row('0001', { name: 'Juan', checked_in_at: '2026-11-26T09:00:00+00:00' }),
    row('0002', { name: 'juan', checked_in_at: '2026-11-26T09:00:30+00:00' }),
    row('0003', { name: 'Juan' }),
    row('0004', { name: 'Ana' }),
  ]
  const { checkIn } = await import('./store')
  const r = await checkIn({ payload: 'TAC Gala-0001', event: 'TAC Gala', staff, method: 'QR' })
  expect(r).toMatchObject({ result: 'checked_in', name: 'Juan', group: { total: 3, here: 2 } })
})

test('a single-ticket guest has no group line, and a failed group lookup never blocks the check-in', async () => {
  rpc.check_in = () => row('0004', { name: 'Ana' })
  tickets = [row('0004', { name: 'Ana', checked_in_at: '2026-11-26T09:00:00+00:00' })]
  const { checkIn } = await import('./store')
  const r = await checkIn({ payload: 'TAC Gala-0004', event: 'TAC Gala', staff, method: 'QR' })
  expect(r.result).toBe('checked_in')
  expect(r.group).toBeUndefined()
})
