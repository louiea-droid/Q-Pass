import 'server-only'
import { auth as gauth, sheets as sheetsApi } from '@googleapis/sheets'
import { decideCheckIn } from './checkin'
import { isValidEventName, normalizeTicket, parsePayload, ticketRange } from './qr'
import { parseStaffRows, withEnvAdmins } from './staff'
import type { EventInfo, LogEntry, LogResult, ScanOutcome, Staff, Ticket } from './types'

// The only module that talks to Google Sheets. Swap this file to move to Supabase.

const HEADERS = {
  Staff: ['Email', 'Name', 'Role', 'Active'],
  Events: ['Name', 'Date', 'Venue', 'Details', 'TicketFrom', 'TicketTo', 'Status'],
  Log: ['Time', 'Event', 'Ticket', 'Result', 'StaffEmail', 'StaffName', 'Method'],
}
const TICKET_HEADERS = ['Ticket', 'Name', 'Info', 'Notes', 'CheckedInAt', 'CheckedInBy', 'Method']

let client: ReturnType<typeof sheetsApi> | undefined
function api() {
  client ??= sheetsApi({
    version: 'v4',
    auth: new gauth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }),
  })
  return client
}
const spreadsheetId = () => process.env.SHEET_ID

/** Retries Google's per-minute quota errors (429) with backoff. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  for (const wait of [500, 1000, 2000, 0]) {
    try {
      return await fn()
    } catch (e) {
      const code = (e as { code?: number; status?: number }).code ?? (e as { status?: number }).status
      if (code !== 429) throw e
      if (!wait) break
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw new Error('Busy, try again')
}

const tab = (name: string) => `'${name}'`
const str = (v: unknown) => (v == null ? '' : String(v))

async function read(range: string): Promise<string[][]> {
  const res = await call(() => api().spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range }))
  return (res.data.values ?? []).map((r) => r.map(str))
}
async function write(range: string, values: string[][]) {
  await call(() =>
    api().spreadsheets.values.update({ spreadsheetId: spreadsheetId(), range, valueInputOption: 'RAW', requestBody: { values } }),
  )
}
async function append(sheet: string, values: string[][]) {
  await call(() =>
    api().spreadsheets.values.append({
      spreadsheetId: spreadsheetId(), range: `${tab(sheet)}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    }),
  )
}
async function addTab(title: string, headers: string[]) {
  await call(() =>
    api().spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId(), requestBody: { requests: [{ addSheet: { properties: { title } } }] } }),
  )
  await write(`${tab(title)}!A1`, [headers])
}

export async function ensureSchema(): Promise<void> {
  const meta = await call(() => api().spreadsheets.get({ spreadsheetId: spreadsheetId(), fields: 'sheets.properties.title' }))
  const have = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title))
  for (const [name, headers] of Object.entries(HEADERS)) if (!have.has(name)) await addTab(name, headers)
}

// ponytail: per-instance memory caches; serverless instances don't share them, so correctness never depends on them.
let staffCache: { at: number; list: Staff[] } | undefined
export async function getStaffList(): Promise<Staff[]> {
  if (!staffCache || Date.now() - staffCache.at > 60_000) staffCache = { at: Date.now(), list: withEnvAdmins(parseStaffRows(await read('Staff!A:D')), process.env.ADMIN_EMAILS) }
  return staffCache.list
}

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
  await addTab(name, TICKET_HEADERS)
  await write(`${tab(name)}!A2`, ticketRange(from, to).map((t) => [t]))
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
  await append('Log', [[new Date().toISOString(), event, ticket, result, staff.email, staff.name, method]])
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
  // Only read the event tab when the earlier rules can't already decide (saves quota).
  const found = scannedEvent === event.name && event.status === 'open' && ticketNo ? await findRow(event.name, ticketNo) : undefined
  const { outcome, update } = decideCheckIn({
    scannedEvent, event, ticket: found?.t, now: new Date().toISOString(), staffName: args.staff.name, method: args.method,
  })
  if (update && found) await write(`${tab(event.name)}!E${found.row}:G${found.row}`, [[update.checkedInAt, update.checkedInBy, update.method]])
  await log(event.name, ticketNo ?? '', outcome.result, args.staff, args.method)
  return outcome
}

export async function undoCheckIn(event: string, ticket: string, staff: Staff): Promise<void> {
  const found = await findRow(event, ticket)
  if (!found) throw new Error('Ticket not found')
  await write(`${tab(event)}!E${found.row}:G${found.row}`, [['', '', '']])
  await log(event, ticket, 'undone', staff, 'manual')
}

export async function getDashboard(event: string): Promise<{
  total: number
  named: number
  namedCheckedIn: number
  checkedIn: number
  perStaff: { name: string; count: number }[]
  recent: LogEntry[]
}> {
  const res = await call(() =>
    api().spreadsheets.values.batchGet({ spreadsheetId: spreadsheetId(), ranges: [`${tab(event)}!A2:G`, 'Log!A2:G'] }),
  )
  const [ticketRows, logRows] = (res.data.valueRanges ?? []).map((v) => (v.values ?? []).map((r) => r.map(str)))
  const tickets = (ticketRows ?? []).filter((r) => r[0]).map(toTicket)
  const counts = new Map<string, number>()
  for (const t of tickets) if (t.checkedInAt) counts.set(t.checkedInBy, (counts.get(t.checkedInBy) ?? 0) + 1)
  const recent = (logRows ?? [])
    .filter((r) => r[1] === event)
    .slice(-30)
    .reverse()
    .map(([time, ev, ticket, result, staffEmail, staffName, method]) =>
      ({ time, event: ev, ticket, result: result as LogResult, staffEmail, staffName, method: method === 'manual' ? 'manual' : 'QR' }) as LogEntry)
  return {
    total: tickets.length,
    named: tickets.filter((t) => t.name).length,
    namedCheckedIn: tickets.filter((t) => t.name && t.checkedInAt).length,
    checkedIn: tickets.filter((t) => t.checkedInAt).length,
    perStaff: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    recent,
  }
}
