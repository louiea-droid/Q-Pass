import 'server-only'
import { decideCheckIn } from './checkin'
import { isValidEventName, normalizeTicket, parsePayload, ticketRange } from './qr'
import type { EventInfo, LogEntry, LogResult, ScanOutcome, Staff, Ticket } from './types'

// Supabase (Postgres) store, talking to its REST API with the server-only service_role key.
// Schema and the check_in / dashboard functions: supabase/schema.sql.

type Row = Record<string, unknown>

async function sb<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  // Accept the base URL or the ".../rest/v1/" form the Supabase dashboard's Copy button gives.
  const url = process.env.SUPABASE_URL?.trim().replace(/\/(rest\/v1)?\/?$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: key,
      // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys must not.
      ...(!key.startsWith('sb_') && { Authorization: `Bearer ${key}` }),
      'Content-Type': 'application/json',
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    if (data?.code === '23505') throw new Error('Duplicate')
    throw new Error(data?.message ?? `Database error (${res.status})`)
  }
  return { data: data as T, range: res.headers.get('Content-Range') }
}

const q = encodeURIComponent

export async function ensureSchema(): Promise<void> {
  await sb('events?select=name&limit=1') // checks the connection; tables come from supabase/schema.sql
}

const toEvent = (r: Row): EventInfo => ({
  name: String(r.name), date: String(r.date ?? ''), venue: String(r.venue ?? ''), details: String(r.details ?? ''),
  ticketFrom: String(r.ticket_from), ticketTo: String(r.ticket_to), status: r.status === 'closed' ? 'closed' : 'open',
})

export async function listEvents(): Promise<EventInfo[]> {
  return (await sb<Row[]>('events?select=*&order=created_at')).data.map(toEvent)
}
export async function getEvent(name: string): Promise<EventInfo | undefined> {
  const { data } = await sb<Row[]>(`events?select=*&name=eq.${q(name)}`)
  return data[0] ? toEvent(data[0]) : undefined
}

export async function createEvent(e: EventInfo): Promise<void> {
  const name = e.name.trim()
  if (!isValidEventName(name)) throw new Error('Event name: letters, numbers, spaces and dashes only, up to 40 characters.')
  const from = normalizeTicket(e.ticketFrom), to = normalizeTicket(e.ticketTo)
  if (!from || !to || Number(from) > Number(to)) throw new Error('Ticket range must be two numbers from 0000 to 9999, first ≤ last.')
  try {
    await sb('events', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: { name, date: e.date, venue: e.venue, details: e.details, ticket_from: from, ticket_to: to, status: 'open' },
    })
  } catch (err) {
    throw (err as Error).message === 'Duplicate' ? new Error('An event with that name already exists.') : err
  }
  await sb('tickets', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: ticketRange(from, to).map((ticket) => ({ event: name, ticket })) })
}

export async function updateEvent(name: string, patch: Partial<Omit<EventInfo, 'name'>>): Promise<void> {
  const body = Object.fromEntries(
    Object.entries({ date: patch.date, venue: patch.venue, details: patch.details, status: patch.status }).filter(([, v]) => v !== undefined),
  )
  await sb(`events?name=eq.${q(name)}`, { method: 'PATCH', body, headers: { Prefer: 'return=minimal' } })
}

const toTicket = (r: Row): Ticket => ({
  ticket: String(r.ticket), name: String(r.name ?? ''), info: String(r.info ?? ''), notes: String(r.notes ?? ''),
  checkedInAt: r.checked_in_at ? String(r.checked_in_at) : '', checkedInBy: String(r.checked_in_by ?? ''),
  method: r.method === 'QR' || r.method === 'manual' ? r.method : '',
})

/** Supabase returns at most 1,000 rows per request, so read in pages. */
export async function listTickets(event: string): Promise<Ticket[]> {
  const out: Ticket[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb<Row[]>(`tickets?select=*&event=eq.${q(event)}&order=ticket`, {
      headers: { 'Range-Unit': 'items', Range: `${from}-${from + 999}` },
    })
    out.push(...data.map(toTicket))
    if (data.length < 1000) return out
  }
}

export async function updateTicket(event: string, ticket: string, patch: Partial<Pick<Ticket, 'name' | 'info' | 'notes'>>): Promise<void> {
  const { data } = await sb<Row[]>(`tickets?event=eq.${q(event)}&ticket=eq.${q(ticket)}`, {
    method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' },
  })
  if (!data?.length) throw new Error('Ticket not found')
}

async function log(event: string, ticket: string, result: LogResult, staff: Staff, method: 'QR' | 'manual') {
  await sb('log', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: { event, ticket, result, staff_name: staff.name, staff_role: staff.role, method },
  })
}

export async function checkIn(args: {
  payload: string | null
  event: string
  ticket?: string
  staff: Staff
  method: 'QR' | 'manual'
}): Promise<ScanOutcome> {
  const event = await getEvent(args.event)
  if (!event) throw new Error('Event not found')
  const parsed = args.method === 'QR' ? parsePayload(args.payload ?? '') : null
  const scannedEvent = args.method === 'manual' ? event.name : (parsed?.event ?? null)
  const ticketNo = args.method === 'manual' ? args.ticket : parsed?.ticket
  const decide = (ticket: Ticket | undefined) =>
    decideCheckIn({ scannedEvent, event, ticket, now: new Date().toISOString(), staffName: args.staff.name, method: args.method }).outcome

  const early = decide(ticketNo ? ({ ticket: ticketNo } as Ticket) : undefined)
  if (early.result !== 'checked_in' && early.result !== 'already_checked_in') {
    await log(event.name, ticketNo ?? '', early.result, args.staff, args.method).catch((e) => console.error('Log write failed', e))
    return early
  }

  // Atomic in the database: two phones can't both check in the same ticket.
  const { data: before } = await sb<Row | null>('rpc/check_in', {
    method: 'POST',
    body: { p_event: event.name, p_ticket: ticketNo, p_staff_name: args.staff.name, p_staff_role: args.staff.role, p_method: args.method },
  })
  return decide(before ? toTicket(before) : undefined)
}

export async function undoCheckIn(event: string, ticket: string, staff: Staff): Promise<void> {
  const { data } = await sb<Row[]>(`tickets?event=eq.${q(event)}&ticket=eq.${q(ticket)}`, {
    method: 'PATCH', body: { checked_in_at: null, checked_in_by: '', method: '' }, headers: { Prefer: 'return=representation' },
  })
  if (!data?.length) throw new Error('Ticket not found')
  await log(event, ticket, 'undone', staff, 'manual').catch((e) => console.error('Log write failed', e))
}

export async function getDashboard(event: string): Promise<{
  total: number
  named: number
  namedCheckedIn: number
  checkedIn: number
  perStaff: { name: string; count: number }[]
  recent: LogEntry[]
}> {
  return (await sb<Awaited<ReturnType<typeof getDashboard>>>('rpc/dashboard', { method: 'POST', body: { p_event: event } })).data
}
