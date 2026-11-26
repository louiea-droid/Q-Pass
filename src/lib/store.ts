import 'server-only'
import { groupCounts, groupKey } from './groups'
import * as db from './store-supabase'

// All data lives in Supabase (store-supabase.ts). This file adds what the door needs on top of a check-in.
export { ensureSchema, listEvents, getEvent, createEvent, addTickets, removeTickets, updateEvent, deleteEvent, listTickets, updateTicket, giveTicket, undoCheckIn, getDashboard } from './store-supabase'

export const checkIn: typeof db.checkIn = async (args) => {
  const outcome = await db.checkIn(args)
  // Several tickets under one name (a family): tell the door how many of them are in.
  if (outcome.name && (outcome.result === 'checked_in' || outcome.result === 'already_checked_in')) {
    try {
      const g = groupCounts(await db.listByName(args.event, outcome.name)).get(groupKey(outcome.name))
      if (g && g.total > 1) outcome.group = g
    } catch (e) {
      console.error('Group lookup failed (check-in itself is saved)', e)
    }
  }
  return outcome
}
