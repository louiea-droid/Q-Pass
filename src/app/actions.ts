'use server'

import { requireStaff } from '@/lib/guard'
import { planGive } from '@/lib/groups'
import { normalizeTicket } from '@/lib/qr'
import { checkIn, createEvent, getEvent, listTickets, undoCheckIn, updateEvent, updateTicket } from '@/lib/store'
import type { EventInfo, ScanOutcome } from '@/lib/types'

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

export type ActionResult = { error?: string }

/** Production hides thrown server-action messages, so return them for the UI to show. */
async function attempt(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn()
    return {}
  } catch (e) {
    return { error: (e as Error).message || 'Something went wrong. Try again.' }
  }
}

async function requireOpenEvent(event: string) {
  const e = await getEvent(event)
  if (!e) throw new Error('Event not found')
  if (e.status === 'closed') throw new Error('This event is closed. Reopen it on the Events page to make changes.')
}

export async function updateTicketAction(
  event: string,
  ticket: string,
  patch: { name?: string; info?: string; notes?: string },
): Promise<ActionResult> {
  await requireStaff('admin')
  return attempt(async () => {
    await requireOpenEvent(event)
    await updateTicket(event, ticket, {
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      ...(patch.info !== undefined && { info: patch.info.trim() }),
      ...(patch.notes !== undefined && { notes: patch.notes.trim() }),
    })
  })
}

export async function manualCheckInAction(event: string, ticket: string): Promise<ScanOutcome> {
  const staff = await requireStaff('admin')
  return checkIn({ payload: null, event, ticket, staff, method: 'manual' })
}

export async function undoCheckInAction(event: string, ticket: string): Promise<ActionResult> {
  const staff = await requireStaff('admin')
  return attempt(async () => {
    await requireOpenEvent(event)
    await undoCheckIn(event, ticket, staff)
  })
}

export async function createEventAction(e: EventInfo): Promise<ActionResult> {
  await requireStaff('admin')
  return attempt(() => createEvent({ ...e, name: e.name.trim(), status: 'open' }))
}

export async function updateEventAction(name: string, patch: Partial<Omit<EventInfo, 'name'>>): Promise<ActionResult> {
  await requireStaff('admin')
  const { date, venue, details, status } = patch // range and name are locked after creation
  return attempt(() => updateEvent(name, { date, venue, details, status }))
}

/** Give `count` tickets from `start` to one person (e.g. a family). Refuses if any is someone else's. */
export async function giveTicketsAction(
  event: string,
  start: string,
  count: number,
  name: string,
  info: string,
): Promise<ActionResult & { given?: string[] }> {
  await requireStaff('admin')
  const who = name.trim()
  const first = normalizeTicket(start)
  if (!who) return { error: 'Type the name of the person receiving the tickets.' }
  if (!first) return { error: 'Type the first ticket number, like 0010.' }
  if (!Number.isInteger(count) || count < 1 || count > 50) return { error: 'Give between 1 and 50 tickets at a time.' }
  try {
    await requireOpenEvent(event)
    const plan = planGive(await listTickets(event), first, count, who)
    if (plan.missing.length) return { error: `This event has no ticket ${plan.missing[0]}. Pick an earlier start.` }
    if (plan.taken.length)
      return { error: `Already given: ${plan.taken.map((t) => `${t.ticket} (${t.name})`).join(', ')}. Pick other numbers.` }
    await Promise.all(plan.tickets.map((t) => updateTicket(event, t, { name: who, ...(info.trim() && { info: info.trim() }) })))
    return { given: plan.tickets }
  } catch (e) {
    return { error: (e as Error).message || 'Something went wrong. Try again.' }
  }
}
