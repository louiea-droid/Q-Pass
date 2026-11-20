import 'server-only'
import * as sheets from './store-sheets'
import * as supabase from './store-supabase'

// Data lives in Supabase when SUPABASE_URL is set, otherwise in the Google Sheet (via Apps Script).
// Both modules export the same functions; the types below make sure they stay in step.
const pick = (): typeof sheets => (process.env.SUPABASE_URL ? supabase : sheets)

export const ensureSchema: typeof sheets.ensureSchema = () => pick().ensureSchema()
export const listEvents: typeof sheets.listEvents = () => pick().listEvents()
export const getEvent: typeof sheets.getEvent = (name) => pick().getEvent(name)
export const createEvent: typeof sheets.createEvent = (e) => pick().createEvent(e)
export const updateEvent: typeof sheets.updateEvent = (name, patch) => pick().updateEvent(name, patch)
export const listTickets: typeof sheets.listTickets = (event) => pick().listTickets(event)
export const updateTicket: typeof sheets.updateTicket = (event, ticket, patch) => pick().updateTicket(event, ticket, patch)
export const checkIn: typeof sheets.checkIn = (args) => pick().checkIn(args)
export const undoCheckIn: typeof sheets.undoCheckIn = (event, ticket, staff) => pick().undoCheckIn(event, ticket, staff)
export const getDashboard: typeof sheets.getDashboard = (event) => pick().getDashboard(event)
