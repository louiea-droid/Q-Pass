import { expect, test } from 'vitest'
import { headline, isGiven, matchTicket } from './display'

test('a named ticket is headed by the name', () => {
  expect(headline({ ticket: '0057', name: 'Juan Dela Cruz' })).toBe('Juan Dela Cruz')
})

test('a ticket without a name is headed by its number, never "no name"', () => {
  expect(headline({ ticket: '0057', name: '' })).toBe('Ticket 0057')
  expect(headline({ ticket: '0057', name: '   ' })).toBe('Ticket 0057')
  expect(headline({ ticket: '0057' })).toBe('Ticket 0057')
})


const tk = (o: Partial<{ ticket: string; name: string; info: string; checkedInAt: string }>) =>
  ({ ticket: '0001', name: '', info: '', checkedInAt: '', ...o })

test('a ticket is given once it has a name', () => {
  expect(isGiven(tk({ name: 'Juan' }))).toBe(true)
  expect(isGiven(tk({ name: '  ' }))).toBe(false)
})

test('filters: given / not given / arrived / not arrived', () => {
  const given = tk({ name: 'Juan' }), blank = tk({}), arrived = tk({ checkedInAt: '2026-11-26T09:00:00Z' })
  expect(matchTicket(given, '', 'given')).toBe(true)
  expect(matchTicket(blank, '', 'given')).toBe(false)
  expect(matchTicket(blank, '', 'notgiven')).toBe(true)
  expect(matchTicket(arrived, '', 'in')).toBe(true)
  expect(matchTicket(arrived, '', 'out')).toBe(false)
  expect(matchTicket(blank, '', 'all')).toBe(true)
})

test('search matches ticket number, name or details, ignoring case and spaces', () => {
  const t = tk({ ticket: '0057', name: 'Juan Dela Cruz', info: 'Choir' })
  expect(matchTicket(t, '57', 'all')).toBe(true)
  expect(matchTicket(t, ' cruz ', 'all')).toBe(true)
  expect(matchTicket(t, 'CHOIR', 'all')).toBe(true)
  expect(matchTicket(t, 'maria', 'all')).toBe(false)
})
