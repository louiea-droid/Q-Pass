'use server'

import { requireStaff } from '@/lib/guard'
import { parseGuestCsv, planImport } from '@/lib/csv'
import { planGive } from '@/lib/groups'
import { normalizeTicket } from '@/lib/qr'
import { addTickets, removeTickets, checkIn, createEvent, deleteEvent, getEvent, giveTicket, listTickets, undoCheckIn, updateEvent, updateTicket } from '@/lib/store'
import type { EventInfo, ScanOutcome } from '@/lib/types'

// Door scans go through /api/scan (a plain request the phone can cancel), not a server action.

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

/** `change` = tickets to add (+) or remove (−) at the end. The name and first ticket are locked. */
export async function updateEventAction(name: string, patch: Partial<Omit<EventInfo, 'name'>>, change = 0): Promise<ActionResult & { lastTicket?: string }> {
  await requireStaff('admin')
  const { date, venue, details, status } = patch
  try {
    const lastTicket = change > 0 ? await addTickets(name, change) : change < 0 ? await removeTickets(name, -change) : undefined
    await updateEvent(name, { date, venue, details, status })
    return { lastTicket }
  } catch (e) {
    return { error: (e as Error).message || 'Something went wrong. Try again.' }
  }
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
    const ok = await Promise.all(plan.tickets.map((t) => giveTicket(event, t, who, info.trim())))
    const given = plan.tickets.filter((_, i) => ok[i])
    const lost = plan.tickets.filter((_, i) => !ok[i])
    if (lost.length)
      return {
        given, // these did go through; the table shows them
        error: `Someone else just gave ticket ${lost.join(', ')}.${given.length ? ` ${given.join(', ')} went to ${who}.` : ''} Reload the page to see who has it.`,
      }
    return { given }
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
    // ponytail: 10 updates at a time, about 1 s per 100 rows. A bulk upsert is the upgrade if lists get big.
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
