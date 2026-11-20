import { expect, test } from 'vitest'
import { decideCheckIn } from './checkin'
import type { EventInfo, Ticket } from './types'

const event: EventInfo = {
  name: 'TAC Thanksgiving 2026', date: '2026-11-26', venue: 'Hall', details: '',
  ticketFrom: '0000', ticketTo: '1000', status: 'open',
}
const blank = (ticket: string, name = ''): Ticket =>
  ({ ticket, name, info: '', notes: '', checkedInAt: '', checkedInBy: '', method: '' })
const base = { event, now: '2026-11-26T09:00:00.000Z', staffName: 'Maria', method: 'QR' as const }

test('wrong_event names the other event and writes nothing', () => {
  const r = decideCheckIn({ ...base, scannedEvent: 'Old Gala', ticket: blank('0001') })
  expect(r.outcome.result).toBe('wrong_event')
  expect(r.outcome.message).toContain('Old Gala')
  expect(r.update).toBeUndefined()
})

test('event_closed when the event is closed', () => {
  const r = decideCheckIn({ ...base, event: { ...event, status: 'closed' }, scannedEvent: event.name, ticket: blank('0001') })
  expect(r.outcome.result).toBe('event_closed')
  expect(r.update).toBeUndefined()
})

test('not_found when the ticket is not in the event', () => {
  const r = decideCheckIn({ ...base, scannedEvent: event.name, ticket: undefined })
  expect(r.outcome.result).toBe('not_found')
})

test('not_found with "Not a Q-Pass ticket" when the QR is not a ticket', () => {
  const r = decideCheckIn({ ...base, scannedEvent: null, ticket: undefined })
  expect(r.outcome.result).toBe('not_found')
  expect(r.outcome.message).toBe('Not a Q-Pass ticket')
})

test('second scan is already_checked_in with original time and staff, no overwrite', () => {
  const done = { ...blank('0001', 'Juan'), checkedInAt: '2026-11-26T08:00:00.000Z', checkedInBy: 'Ana', method: 'QR' as const }
  const r = decideCheckIn({ ...base, scannedEvent: event.name, ticket: done })
  expect(r.outcome.result).toBe('already_checked_in')
  expect(r.outcome.checkedInAt).toBe('2026-11-26T08:00:00.000Z')
  expect(r.outcome.checkedInBy).toBe('Ana')
  expect(r.update).toBeUndefined()
})

test('checked_in with a name shows the name and records QR', () => {
  const r = decideCheckIn({ ...base, scannedEvent: event.name, ticket: blank('0001', 'Juan Dela Cruz') })
  expect(r.outcome.result).toBe('checked_in')
  expect(r.outcome.message).toContain('Juan Dela Cruz')
  expect(r.update).toEqual({ checkedInAt: base.now, checkedInBy: 'Maria', method: 'QR' })
})

test('checked_in without a name says so', () => {
  const r = decideCheckIn({ ...base, scannedEvent: event.name, ticket: blank('0057') })
  expect(r.outcome.result).toBe('checked_in')
  expect(r.outcome.message).toBe('Ticket 0057 — no name')
})

test('manual check-in records method manual', () => {
  const r = decideCheckIn({ ...base, method: 'manual', scannedEvent: event.name, ticket: blank('0002') })
  expect(r.update?.method).toBe('manual')
})
