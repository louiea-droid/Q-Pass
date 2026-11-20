export type Role = 'admin' | 'scanner'

export type Staff = { name: string; role: Role }

export type EventInfo = {
  name: string
  date: string
  venue: string
  details: string
  ticketFrom: string
  ticketTo: string
  status: 'open' | 'closed'
}

export type Ticket = {
  ticket: string
  name: string
  info: string
  notes: string
  checkedInAt: string
  checkedInBy: string
  method: '' | 'QR' | 'manual'
}

export type LogResult =
  | 'checked_in'
  | 'already_checked_in'
  | 'not_found'
  | 'wrong_event'
  | 'event_closed'
  | 'undone'

export type LogEntry = {
  time: string
  event: string
  ticket: string
  result: LogResult
  staffRole: string
  staffName: string
  method: 'QR' | 'manual'
}

export type ScanOutcome = {
  result: LogResult
  ticket?: string
  name?: string
  message: string
  checkedInAt?: string
  checkedInBy?: string
}
