import { ticketsCsv } from '@/lib/csv'
import { noShows } from '@/lib/display'
import { currentStaff } from '@/lib/guard'
import { getEvent, listTickets } from '@/lib/store'

/** Admin download of an event's tickets as CSV (opens in Excel or Google Sheets). */
export async function GET(request: Request) {
  const staff = await currentStaff()
  if (staff?.role !== 'admin') return new Response('Admins only', { status: 403 })
  const params = new URL(request.url).searchParams
  const event = params.get('event') ?? ''
  if (!(await getEvent(event))) return new Response('Event not found', { status: 404 })
  const onlyNoShows = params.get('only') === 'noshow'
  const tickets = await listTickets(event)
  const csv = '﻿' + ticketsCsv(onlyNoShows ? noShows(tickets) : tickets) // BOM so Excel reads names with accents correctly
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.replace(/[^A-Za-z0-9 -]/g, '')} ${onlyNoShows ? 'no-shows' : 'tickets'}.csv"`,
    },
  })
}
