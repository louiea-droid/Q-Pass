import 'server-only'
import { decideCheckIn } from './checkin'
import { isValidEventName, normalizeTicket, parsePayload, ticketRange } from './qr'
import type { EventInfo, LogEntry, LogResult, ScanOutcome, Staff, Ticket } from './types'

// The only module that talks to the Google Sheet, via the Apps Script in apps-script/Code.gs.
// Swap this file to move to Supabase.

const HEADERS = {
  Events: ['Name', 'Date', 'Venue', 'Details', 'TicketFrom', 'TicketTo', 'Status'],
  Log: ['Time', 'Event', 'Ticket', 'Result', 'StaffName', 'Role', 'Method'],
}
const TICKET_HEADERS = ['Ticket', 'Name', 'Info', 'Notes', 'CheckedInAt', 'CheckedInBy', 'Method']

/** Calls one operation of the Sheet's Apps Script web app. Retries once on network/Google hiccups. */
async function gas<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const url = process.env.APPS_SCRIPT_URL
  if (!url) throw new Error('APPS_SCRIPT_URL is not set')
  const body = JSON.stringify({ secret: process.env.APPS_SCRIPT_SECRET, op, args })
  let lastError = 'Busy, try again'
  for (const wait of [0, 1000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait))
    let res: { ok: boolean; data?: T; error?: string }
    try {
      // text/plain keeps it a "simple" request; Apps Script answers via a redirect that fetch follows.
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, cache: 'no-store' })
      res = await r.json()
    } catch {
      continue // network error or Google's HTML error page: retry
    }
    if (res.ok) return res.data as T
    lastError = res.error ?? lastError
    if (!/too many times|lock|timed out/i.test(lastError)) break // only retry Google's busy errors
  }
  throw new Error(lastError)
}

const tab = (name: string) => `'${name}'`

const read = (range: string) => gas<string[][]>('read', { range })
const write = (range: string, values: string[][]) => gas<null>('write', { range, values })
const append = (sheet: string, values: string[][]) => gas<null>('append', { sheet, values })
const addTab = (title: string, headers: string[], rowCount = 1000) => gas<null>('addSheet', { title, headers, rowCount })

export async function ensureSchema(): Promise<void> {
  const have = new Set(await gas<string[]>('titles'))
  for (const [name, headers] of Object.entries(HEADERS)) if (!have.has(name)) await addTab(name, headers)
}

// ponytail: per-instance memory cache; serverless instances don't share it, so correctness never depends on it.
let eventsCache: { at: number; list: EventInfo[] } | undefined
export async function listEvents(): Promise<EventInfo[]> {
  if (!eventsCache || Date.now() - eventsCache.at > 10_000) {
    const rows = (await read('Events!A2:G')).filter((r) => r[0])
    eventsCache = {
      at: Date.now(),
      list: rows.map(([name, date = '', venue = '', details = '', from = '', to = '', status = '']) => ({
        name, date, venue, details,
        ticketFrom: normalizeTicket(from) ?? '0000',
        ticketTo: normalizeTicket(to) ?? '1000',
        status: status.trim().toLowerCase() === 'closed' ? 'closed' : 'open',
      })),
    }
  }
  return eventsCache.list
}
export const getEvent = async (name: string) => (await listEvents()).find((e) => e.name === name)

export async function createEvent(e: EventInfo): Promise<void> {
  const name = e.name.trim()
  if (!isValidEventName(name)) throw new Error('Event name: letters, numbers, spaces and dashes only, up to 40 characters.')
  const from = normalizeTicket(e.ticketFrom), to = normalizeTicket(e.ticketTo)
  if (!from || !to || Number(from) > Number(to)) throw new Error('Ticket range must be two numbers from 0000 to 9999, first ≤ last.')
  eventsCache = undefined
  if ((await listEvents()).some((x) => x.name.toLowerCase() === name.toLowerCase())) throw new Error('An event with that name already exists.')
  const tickets = ticketRange(from, to)
  await addTab(name, TICKET_HEADERS, tickets.length + 1) // new tabs only have 1,000 rows; writes past the grid fail
  await write(`${tab(name)}!A2`, tickets.map((t) => [t]))
  await append('Events', [[name, e.date, e.venue, e.details, from, to, e.status]])
  eventsCache = undefined
}

export async function updateEvent(name: string, patch: Partial<Omit<EventInfo, 'name'>>): Promise<void> {
  const rows = await read('Events!A2:A')
  const i = rows.findIndex((r) => r[0] === name)
  if (i < 0) throw new Error('Event not found')
  eventsCache = undefined // read the latest values, not a cached copy, before merging
  const cur = await getEvent(name)
  const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  const e = { ...cur!, ...set }
  // Name (A) and ticket range (E:F) never change after creation.
  await write(`Events!B${i + 2}:D${i + 2}`, [[e.date, e.venue, e.details]])
  await write(`Events!G${i + 2}`, [[e.status]])
  eventsCache = undefined
}

/** Deletes the event row, its ticket tab and its log rows, in one script call. */
export async function deleteEvent(name: string): Promise<void> {
  try {
    await gas<null>('deleteEvent', { name })
  } catch (e) {
    if (/unknown operation/i.test((e as Error).message))
      throw new Error('To delete events, update the Apps Script: paste the new apps-script/Code.gs into the Sheet and deploy again.')
    throw e
  } finally {
    eventsCache = undefined
  }
}

function toTicket(r: string[]): Ticket {
  const [ticket = '', name = '', info = '', notes = '', checkedInAt = '', checkedInBy = '', method = ''] = r
  return {
    ticket: normalizeTicket(ticket) ?? ticket, name, info, notes, checkedInAt, checkedInBy,
    method: method === 'QR' || method === 'manual' ? method : '',
  }
}
export async function listTickets(event: string): Promise<Ticket[]> {
  return (await read(`${tab(event)}!A2:G`)).filter((r) => r[0]).map(toTicket)
}

/** Rows are matched by the Ticket column, never by position (people may sort the tab). */
async function findRow(event: string, ticket: string): Promise<{ row: number; t: Ticket } | undefined> {
  const rows = await read(`${tab(event)}!A2:G`)
  const i = rows.findIndex((r) => r[0] && normalizeTicket(r[0]) === ticket)
  return i < 0 ? undefined : { row: i + 2, t: toTicket(rows[i]) }
}

export async function updateTicket(event: string, ticket: string, patch: Partial<Pick<Ticket, 'name' | 'info' | 'notes'>>): Promise<void> {
  const found = await findRow(event, ticket)
  if (!found) throw new Error('Ticket not found')
  const t = { ...found.t, ...patch }
  await write(`${tab(event)}!B${found.row}:D${found.row}`, [[t.name, t.info, t.notes]])
}

async function log(event: string, ticket: string, result: LogResult, staff: Staff, method: 'QR' | 'manual') {
  await append('Log', [[new Date().toISOString(), event, ticket, result, staff.name, staff.role, method]])
}

export async function checkIn(args: {
  payload: string | null
  event: string
  ticket?: string
  staff: Staff
  method: 'QR' | 'manual'
}): Promise<ScanOutcome> {
  const event = await getEvent(args.event)
  // Deleted (e.g. a scan saved offline before the event was removed): answer red instead of throwing, so it is not retried forever.
  if (!event) return { result: 'event_closed', message: 'This event was deleted' }
  const parsed = args.method === 'QR' ? parsePayload(args.payload ?? '') : null
  const scannedEvent = args.method === 'manual' ? event.name : (parsed?.event ?? null)
  const ticketNo = args.method === 'manual' ? args.ticket : parsed?.ticket
  const now = new Date().toISOString()
  const decide = (ticket: Ticket | undefined) =>
    decideCheckIn({ scannedEvent, event, ticket, now, staffName: args.staff.name, method: args.method }).outcome

  // Event-level rejections (not a ticket, other event, closed) need no ticket lookup.
  const early = decide(ticketNo ? { ticket: ticketNo } as Ticket : undefined)
  if (early.result !== 'checked_in' && early.result !== 'already_checked_in') {
    await log(event.name, ticketNo ?? '', early.result, args.staff, args.method).catch((e) => console.error('Log write failed', e))
    return early
  }

  // One locked script call finds the row, marks it if still free, and logs: two phones can't both win.
  const before = await gas<string[] | null>('checkIn', {
    event: event.name, ticket: ticketNo, now, staffName: args.staff.name, staffRole: args.staff.role, method: args.method,
  })
  return decide(before ? toTicket(before) : undefined)
}

export async function undoCheckIn(event: string, ticket: string, staff: Staff): Promise<void> {
  const found = await findRow(event, ticket)
  if (!found) throw new Error('Ticket not found')
  await write(`${tab(event)}!E${found.row}:G${found.row}`, [['', '', '']])
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
  const [ticketRows, logRows] = await gas<string[][][]>('readMany', { ranges: [`${tab(event)}!A2:G`, 'Log!A2:G'] })
  const tickets = (ticketRows ?? []).filter((r) => r[0]).map(toTicket)
  const counts = new Map<string, number>()
  for (const t of tickets) if (t.checkedInAt) counts.set(t.checkedInBy, (counts.get(t.checkedInBy) ?? 0) + 1)
  const recent = (logRows ?? [])
    .filter((r) => r[1] === event)
    .slice(-30)
    .reverse()
    .map(([time, ev, ticket, result, staffName, staffRole, method]) =>
      ({ time, event: ev, ticket, result: result as LogResult, staffName, staffRole, method: method === 'manual' ? 'manual' : 'QR' }) as LogEntry)
  return {
    total: tickets.length,
    named: tickets.filter((t) => t.name).length,
    namedCheckedIn: tickets.filter((t) => t.name && t.checkedInAt).length,
    checkedIn: tickets.filter((t) => t.checkedInAt).length,
    perStaff: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    recent,
  }
}
