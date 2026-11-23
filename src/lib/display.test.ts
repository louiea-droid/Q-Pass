import { expect, test } from 'vitest'
import { arrivalBuckets, headline, isGiven, matchTicket, noShows } from './display'

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

test('arrival counts from the ticket list, so the desk shows real numbers before its first refresh', async () => {
  const { arrivalCounts } = await import('./display')
  const t = (name: string, checkedInAt = '') => ({ ticket: '', name, checkedInAt })
  expect(arrivalCounts([t('Ana', '2026-11-26T09:00:00Z'), t('Juan'), t('', '2026-11-26T09:05:00Z'), t('')])).toEqual({
    total: 4,
    named: 2,
    namedCheckedIn: 1,
    checkedIn: 2,
  })
})

const utc = (hm: string) => Date.parse(`2027-01-03T${hm}:00Z`)

test('arrivalBuckets: 15-minute buckets from first to last arrival, empty ones in between', () => {
  expect(arrivalBuckets(['2027-01-03T10:01:00Z', '2027-01-03T10:14:59Z', '2027-01-03T10:46:00Z'])).toEqual([
    { start: utc('10:00'), count: 2 },
    { start: utc('10:15'), count: 0 },
    { start: utc('10:30'), count: 0 },
    { start: utc('10:45'), count: 1 },
  ])
})

test('arrivalBuckets: no valid times gives no buckets', () => {
  expect(arrivalBuckets(['', 'x'])).toEqual([])
})

test('noShows: named tickets that never checked in, by ticket number', () => {
  const t = (ticket: string, name: string, checkedInAt = '') => ({ ticket, name, checkedInAt })
  expect(noShows([t('0003', 'C'), t('0001', 'A'), t('0002', ''), t('0004', 'D', '2027-01-03T10:00:00Z')]).map((x) => x.ticket)).toEqual([
    '0001',
    '0003',
  ])
})
