import 'server-only'
import { decideCheckIn } from './checkin'
import { groupKey } from './groups'
import { MAX_TICKETS, isValidEventName, normalizeTicket, parsePayload, ticketRange } from './qr'
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
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Not JSON: Supabase's gateway answered instead of the database (project paused, restarting or down).
    throw new Error(
      `Supabase isn’t responding (error ${res.status}). Open your project at supabase.com: if it says Paused, click Restore; otherwise restart it from Project Settings.`,
    )
  }
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
  if (!from || !to || Number(from) > Number(to)) throw new Error('Ticket range must be two whole numbers (up to 9 digits), first ≤ last.')
  if (Number(to) - Number(from) + 1 > MAX_TICKETS) throw new Error(`An event can have up to ${MAX_TICKETS.toLocaleString('en')} tickets.`)
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

/** Adds `count` tickets after the event's last one. Returns the new last ticket number. */
export async function addTickets(name: string, count: number): Promise<string> {
  const e = await getEvent(name)
  if (!e) throw new Error('Event not found')
  if (!Number.isInteger(count) || count < 1) throw new Error('Type how many tickets to add, like 50.')
  const to = normalizeTicket(Number(e.ticketTo) + count)
  if (!to) throw new Error('That goes past the biggest ticket number (9 digits).')
  const total = Number(to) - Number(e.ticketFrom) + 1
  if (total > MAX_TICKETS)
    throw new Error(`An event can have up to ${MAX_TICKETS.toLocaleString('en')} tickets. This one has ${(total - count).toLocaleString('en')}.`)
  const added = ticketRange(String(Number(e.ticketTo) + 1), to)
  // Tickets first, then the range: if the second step fails, saving again just skips the tickets already there.
  await sb('tickets', {
    method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: added.map((ticket) => ({ event: name, ticket })),
  })
  await sb(`events?name=eq.${q(name)}`, { method: 'PATCH', body: { ticket_to: to }, headers: { Prefer: 'return=minimal' } })
  return to
}

/** Removes the last `count` tickets, only if none of them has a name or a check-in. Returns the new last ticket number. */
export async function removeTickets(name: string, count: number): Promise<string> {
  const e = await getEvent(name)
  if (!e) throw new Error('Event not found')
  if (!Number.isInteger(count) || count < 1) throw new Error('Type how many tickets to remove, like 50.')
  const to = Number(e.ticketTo) - count
  if (to < Number(e.ticketFrom)) throw new Error(`This event has ${(Number(e.ticketTo) - Number(e.ticketFrom) + 1).toLocaleString('en')} tickets; keep at least one.`)
  const gone = ticketRange(String(to + 1), e.ticketTo)
  const goneSet = new Set(gone)
  const used = (await listTickets(name)).filter((t) => goneSet.has(t.ticket) && (t.name.trim() || t.checkedInAt)).map((t) => t.ticket)
  if (used.length)
    throw new Error(
      `Can’t remove: ${used.slice(0, 5).join(', ')}${used.length > 5 ? ` and ${used.length - 5} more` : ''} ${used.length === 1 ? 'is' : 'are'} given or checked in. Clear ${used.length === 1 ? 'it' : 'them'} first, or remove fewer.`,
    )
  // Only still-unused rows are deleted, so a ticket given out a moment ago survives.
  // ponytail: that ticket then sits past the new last number (still scans, missing from the QR page); rare enough to leave.
  for (let i = 0; i < gone.length; i += 200)
    await sb(`tickets?event=eq.${q(name)}&ticket=in.(${gone.slice(i, i + 200).join(',')})&name=eq.&checked_in_at=is.null`, { method: 'DELETE' })
  const last = String(to).padStart(4, '0')
  await sb(`events?name=eq.${q(name)}`, { method: 'PATCH', body: { ticket_to: last }, headers: { Prefer: 'return=minimal' } })
  return last
}

export async function updateEvent(name: string, patch: Partial<Omit<EventInfo, 'name'>>): Promise<void> {
  const body = Object.fromEntries(
    Object.entries({ date: patch.date, venue: patch.venue, details: patch.details, status: patch.status }).filter(([, v]) => v !== undefined),
  )
  await sb(`events?name=eq.${q(name)}`, { method: 'PATCH', body, headers: { Prefer: 'return=minimal' } })
}

/** Deletes the event and everything under it: its scan log, then the event row (tickets cascade). */
export async function deleteEvent(name: string): Promise<void> {
  await sb(`log?event=eq.${q(name)}`, { method: 'DELETE' })
  await sb(`events?name=eq.${q(name)}`, { method: 'DELETE' })
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
    // The database sorts as text ("10000" before "9999"), so put them in number order here.
    if (data.length < 1000) return out.sort((a, b) => Number(a.ticket) - Number(b.ticket))
  }
}

/** An ilike pattern for a name, the way groupKey compares names: any case, any spacing between words. */
const likeName = (name: string) => groupKey(name).replace(/[\\%_]/g, '\\$&').replace(/ /g, '%')

/**
 * The tickets carrying this name, for the family count at the door: a few rows instead of the whole event.
 * `%` at the ends also catches names saved with stray spaces; the caller keeps exact matches (groupKey).
 */
export async function listByName(event: string, name: string): Promise<Ticket[]> {
  const { data } = await sb<Row[]>(`tickets?select=*&event=eq.${q(event)}&name=ilike.${q(`%${likeName(name)}%`)}`)
  return data.map(toTicket)
}

export async function updateTicket(event: string, ticket: string, patch: Partial<Pick<Ticket, 'name' | 'info' | 'notes'>>): Promise<void> {
  const { data } = await sb<Row[]>(`tickets?event=eq.${q(event)}&ticket=eq.${q(ticket)}`, {
    method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' },
  })
  if (!data?.length) throw new Error('Ticket not found')
}

/**
 * Puts `name` on a ticket only if it is still free or already that person's (any case), in one step, so two admins
 * giving the same ticket at once can't both succeed. False when someone else got it first.
 */
export async function giveTicket(event: string, ticket: string, name: string, info: string): Promise<boolean> {
  const freeFor = q(`(name.is.null,name.eq."",name.ilike."${likeName(name).replace(/[\\"]/g, '\\$&')}")`) // quoted for PostgREST
  const { data } = await sb<Row[]>(`tickets?event=eq.${q(event)}&ticket=eq.${q(ticket)}&or=${freeFor}`, {
    method: 'PATCH', body: { name, ...(info && { info }) }, headers: { Prefer: 'return=representation' },
  })
  return !!data?.length
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
  // The event's status is checked inside check_in (one trip per scan); until then treat it as open.
  const event: EventInfo = { name: args.event, status: 'open', date: '', venue: '', details: '', ticketFrom: '', ticketTo: '' }
  const parsed = args.method === 'QR' ? parsePayload(args.payload ?? '') : null
  const scannedEvent = args.method === 'manual' ? event.name : (parsed?.event ?? null)
  const ticketNo = args.method === 'manual' ? args.ticket : parsed?.ticket
  const decide = (ticket: Ticket | undefined, e = event) =>
    decideCheckIn({ scannedEvent, event: e, ticket, now: new Date().toISOString(), staffName: args.staff.name, method: args.method }).outcome

  // Not a ticket, or another event's: no database needed to say so.
  const early = decide(ticketNo ? ({ ticket: ticketNo } as Ticket) : undefined)
  if (early.result !== 'checked_in' && early.result !== 'already_checked_in') {
    await log(event.name, ticketNo ?? '', early.result, args.staff, args.method).catch((e) => console.error('Log write failed', e))
    return early
  }

  // Atomic in the database: two phones can't both check in the same ticket.
  const { data } = await sb<Row | null>('rpc/check_in', {
    method: 'POST',
    body: { p_event: event.name, p_ticket: ticketNo, p_staff_name: args.staff.name, p_staff_role: args.staff.role, p_method: args.method },
  })
  // Deleted (e.g. a scan saved offline before the event was removed): answer red instead of throwing, so it is not retried forever.
  if (data?.blocked === 'missing') return { result: 'event_closed', message: 'This event was deleted' }
  if (data?.blocked === 'closed') return decide(undefined, { ...event, status: 'closed' })
  return decide(data ? toTicket(data) : undefined)
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
