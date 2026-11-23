'use server'

import { requireStaff } from '@/lib/guard'
import { parseGuestCsv, planImport } from '@/lib/csv'
import { planGive } from '@/lib/groups'
import { normalizeTicket } from '@/lib/qr'
import { checkIn, createEvent, deleteEvent, getEvent, listTickets, undoCheckIn, updateEvent, updateTicket } from '@/lib/store'
import type { EventInfo, ScanOutcome, Staff } from '@/lib/types'

// A scan saved offline is sent later, maybe after someone else signed in on that phone; `by` keeps the original
// scanner's name. Names are typed at sign-in and never verified, so this trusts nothing new; the role stays the session's.
const asScanner = (staff: Staff, by?: string) => ({ ...staff, name: by?.trim().slice(0, 60) || staff.name })

export async function scanAction(event: string, payload: string, by?: string): Promise<ScanOutcome> {
  const staff = asScanner(await requireStaff('scanner'), by)
  return checkIn({ payload, event, staff, method: 'QR' })
}

export async function manualScanAction(event: string, ticketInput: string, by?: string): Promise<ScanOutcome> {
  const staff = asScanner(await requireStaff('scanner'), by)
  const ticket = normalizeTicket(ticketInput)
  if (!ticket) return { result: 'not_found', message: 'Type a ticket number, like 0057' }
  return checkIn({ payload: null, event, ticket, staff, method: 'manual' })
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

/** Give the listed tickets (handed out at random) to one person or family. Refuses if any is someone else's. */
export async function giveTicketsAction(
  event: string,
  numbers: string[],
  name: string,
  info: string,
): Promise<ActionResult & { given?: string[] }> {
  await requireStaff('admin')
  const who = name.trim()
  const list = [...new Set(numbers.map(normalizeTicket))]
  if (!who) return { error: 'Type the name of the person receiving the tickets.' }
  if (!list.length || list.includes(null)) return { error: 'Type the ticket numbers, like 12, 57, 103.' }
  if (list.length > 50) return { error: 'Give up to 50 tickets at a time.' }
  try {
    await requireOpenEvent(event)
    const plan = planGive(await listTickets(event), list as string[], who)
    if (plan.missing.length) return { error: `This event has no ticket ${plan.missing.join(', ')}.` }
    if (plan.taken.length)
      return { error: `Already given: ${plan.taken.map((t) => `${t.ticket} (${t.name})`).join(', ')}. Pick other numbers.` }
    await Promise.all(plan.tickets.map((t) => updateTicket(event, t, { name: who, ...(info.trim() && { info: info.trim() }) })))
    return { given: plan.tickets }
  } catch (e) {
    return { error: (e as Error).message || 'Something went wrong. Try again.' }
  }
}

/** Puts names (and details/notes) from a CSV guest list onto this event's tickets. Blank cells keep what is there. */
export async function importGuestsAction(
  event: string,
  csv: string,
): Promise<ActionResult & { updated?: number; unknown?: string[]; badLines?: number[] }> {
  await requireStaff('admin')
  try {
    await requireOpenEvent(event)
    const { rows, badLines } = parseGuestCsv(csv)
    if (rows.length > 5000) return { error: 'Import up to 5000 rows at a time.' }
    if (!rows.length) return { error: 'No rows with a ticket number were found. The first column should be the ticket number.' }
    const { patches, unknown } = planImport((await listTickets(event)).map((t) => t.ticket), rows)
    // ponytail: 10 updates at a time, about 1 s per 100 rows on Supabase (slower on Sheets). A bulk upsert is the upgrade if lists get big.
    for (let i = 0; i < patches.length; i += 10)
      await Promise.all(patches.slice(i, i + 10).map((p) => updateTicket(event, p.ticket, p.patch)))
    return { updated: patches.length, unknown, badLines }
  } catch (e) {
    return { error: (e as Error).message || 'Something went wrong. Try again.' }
  }
}

/** Deletes an event with its tickets, check-ins and scan log. `typed` must be the exact name (checked here too). */
export async function deleteEventAction(name: string, typed: string): Promise<ActionResult> {
  await requireStaff('admin')
  if (typed !== name) return { error: 'Type the event name exactly as shown to delete it.' }
  return attempt(async () => {
    if (!(await getEvent(name))) throw new Error('Event not found')
    await deleteEvent(name)
  })
}
