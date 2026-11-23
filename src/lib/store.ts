import 'server-only'
import * as sheets from './store-sheets'
import * as supabase from './store-supabase'
import { groupCounts, groupKey } from './groups'

// Data lives in Supabase when SUPABASE_URL is set, otherwise in the Google Sheet (via Apps Script).
// Both modules export the same functions; the types below make sure they stay in step.
const pick = (): typeof sheets => (process.env.SUPABASE_URL ? supabase : sheets)

export const ensureSchema: typeof sheets.ensureSchema = () => pick().ensureSchema()
export const listEvents: typeof sheets.listEvents = () => pick().listEvents()
export const getEvent: typeof sheets.getEvent = (name) => pick().getEvent(name)
export const createEvent: typeof sheets.createEvent = (e) => pick().createEvent(e)
export const updateEvent: typeof sheets.updateEvent = (name, patch) => pick().updateEvent(name, patch)
export const deleteEvent: typeof sheets.deleteEvent = (name) => pick().deleteEvent(name)
export const listTickets: typeof sheets.listTickets = (event) => pick().listTickets(event)
export const updateTicket: typeof sheets.updateTicket = (event, ticket, patch) => pick().updateTicket(event, ticket, patch)
export const checkIn: typeof sheets.checkIn = async (args) => {
  const store = pick()
  const outcome = await store.checkIn(args)
  // Several tickets under one name (a family): tell the door how many of them are in.
  if (outcome.name && (outcome.result === 'checked_in' || outcome.result === 'already_checked_in')) {
    try {
      const g = groupCounts(await store.listTickets(args.event)).get(groupKey(outcome.name))
      if (g && g.total > 1) outcome.group = g
    } catch (e) {
      console.error('Group lookup failed (check-in itself is saved)', e)
    }
  }
  return outcome
}
export const undoCheckIn: typeof sheets.undoCheckIn = (event, ticket, staff) => pick().undoCheckIn(event, ticket, staff)
export const getDashboard: typeof sheets.getDashboard = (event) => pick().getDashboard(event)
