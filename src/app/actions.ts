'use server'

import { requireStaff } from '@/lib/guard'
import { normalizeTicket } from '@/lib/qr'
import { checkIn, listTickets, updateTicket } from '@/lib/store'
import type { ScanOutcome } from '@/lib/types'

export async function scanAction(event: string, payload: string): Promise<ScanOutcome> {
  const staff = await requireStaff('scanner')
  return checkIn({ payload, event, staff, method: 'QR' })
}

export async function manualScanAction(event: string, ticketInput: string): Promise<ScanOutcome> {
  const staff = await requireStaff('scanner')
  const ticket = normalizeTicket(ticketInput)
  if (!ticket) return { result: 'not_found', message: 'Type a ticket number, like 0057' }
  return checkIn({ payload: null, event, ticket, staff, method: 'manual' })
}

/** Scanners may only name a ticket that has no name yet; admins can always rename. */
export async function setNameAction(event: string, ticket: string, name: string): Promise<void> {
  const staff = await requireStaff('scanner')
  if (staff.role !== 'admin') {
    const t = (await listTickets(event)).find((x) => x.ticket === ticket)
    if (!t) throw new Error('Ticket not found')
    if (t.name) throw new Error('This ticket already has a name')
  }
  await updateTicket(event, ticket, { name: name.trim() })
}
