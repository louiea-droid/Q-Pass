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
