import { normalizeTicket } from './qr'
import type { Ticket } from './types'

const HEADER = ['Ticket', 'Name', 'Info', 'Notes', 'CheckedInAt', 'CheckedInBy', 'Method']

// Spreadsheets run cells starting with = + - @ as formulas; a leading ' makes them plain text.
const cell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV for Excel / Google Sheets. Ticket numbers are written as ="0001" so the zeros survive. */
export function ticketsCsv(tickets: Ticket[]): string {
  const rows = tickets.map((t) =>
    [`="${t.ticket}"`, ...[t.name, t.info, t.notes, t.checkedInAt, t.checkedInBy, t.method].map(cell)].join(','),
  )
  return [HEADER.join(','), ...rows].join('\r\n')
}

/** One guest from an imported file. `line` is where the row starts in the file (1-based), for error messages. */
export type GuestRow = { line: number; ticket: string; name: string; info: string; notes: string }

/** Splits CSV text into rows of cells (RFC 4180: quoted cells may hold commas, "" and line breaks). */
function csvRows(text: string): { line: number; cells: string[] }[] {
  const out: { line: number; cells: string[] }[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let start = 1
  const endRow = () => {
    cells.push(cell)
    out.push({ line: start, cells })
    cells = []
    cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else {
        if (c === '\n') line++
        cell += c
      }
    } else if (c === '"' && cell === '') quoted = true // quotes only open a cell at its start, so ="0001" stays literal
    else if (c === ',') {
      cells.push(cell)
      cell = ''
    }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      endRow()
      start = ++line
    } else cell += c
  }
  if (cell || cells.length) endRow()
  return out
}

// Undo what ticketsCsv writes: ="0001" keeps zeros in Excel, and a ' guards cells that look like formulas.
const clean = (v = '') => v.replace(/^="(.*)"$/, '$1').replace(/^'(?=[=+\-@\t\r])/, '').trim()

/**
 * Reads a guest list: ticket number + name, optionally details and notes.
 * With a header row (any cell starting "ticket"), columns are matched by name ("Info" or "Details" both work);
 * without one, the order is ticket, name, details, notes. Blank lines are skipped; lines with no valid
 * ticket number are reported in `badLines`.
 */
export function parseGuestCsv(text: string): { rows: GuestRow[]; badLines: number[] } {
  const all = csvRows(text.replace(/^﻿/, '')).filter((r) => r.cells.some((c) => clean(c)))
  const head = all[0]?.cells.map((c) => clean(c).toLowerCase())
  const hasHeader = !!head?.some((c) => c.startsWith('ticket'))
  const col = (re: RegExp, fallback: number) => (hasHeader ? head!.findIndex((c) => re.test(c)) : fallback)
  const at = { ticket: col(/^ticket/, 0), name: col(/name/, 1), info: col(/^(info|details)/, 2), notes: col(/^notes/, 3) }
  const rows: GuestRow[] = []
  const badLines: number[] = []
  for (const r of hasHeader ? all.slice(1) : all) {
    const get = (i: number) => (i < 0 ? '' : clean(r.cells[i]))
    const ticket = normalizeTicket(get(at.ticket))
    if (!ticket) badLines.push(r.line)
    else rows.push({ line: r.line, ticket, name: get(at.name), info: get(at.info), notes: get(at.notes) })
  }
  return { rows, badLines }
}

type GuestPatch = Partial<Pick<Ticket, 'name' | 'info' | 'notes'>>

/** What an import changes: only non-blank cells, only tickets this event has; for a repeated ticket the last row wins. */
export function planImport(existing: string[], rows: GuestRow[]): { patches: { ticket: string; patch: GuestPatch }[]; unknown: string[] } {
  const have = new Set(existing)
  const byTicket = new Map<string, GuestPatch>()
  const unknown = new Set<string>()
  for (const r of rows) {
    if (!have.has(r.ticket)) {
      unknown.add(r.ticket)
      continue
    }
    const patch: GuestPatch = {}
    for (const k of ['name', 'info', 'notes'] as const) if (r[k]) patch[k] = r[k]
    byTicket.delete(r.ticket) // last row wins, and keeps file order
    if (Object.keys(patch).length) byTicket.set(r.ticket, patch)
  }
  return { patches: [...byTicket].map(([ticket, patch]) => ({ ticket, patch })), unknown: [...unknown] }
}

/** File bytes to text: UTF-8 when valid, else Windows-1252 (what Excel on Windows saves as "CSV"), so ñ survives. */
export function decodeCsv(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('windows-1252').decode(buf)
  }
}

/** Blank guest list to fill in: every ticket number, empty Name/Details/Notes. Imports back cleanly (blank cells change nothing). */
export const guestTemplateCsv = (tickets: Pick<Ticket, 'ticket'>[]): string =>
  ['Ticket,Name,Details,Notes', ...tickets.map((t) => `="${t.ticket}",,,`)].join('\r\n')
