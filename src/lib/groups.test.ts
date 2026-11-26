import { expect, test } from 'vitest'
import { groupCounts, groupKey, parseTicketList, planGive } from './groups'

const t = (ticket: string, name = '', checkedInAt = '') => ({ ticket, name, checkedInAt })

test('group key ignores case and extra spaces', () => {
  expect(groupKey('  Juan   Dela Cruz ')).toBe(groupKey('juan dela cruz'))
  expect(groupKey('')).toBe('')
})

test('group counts: tickets per name and how many are here', () => {
  const counts = groupCounts([
    t('0001', 'Juan Dela Cruz', '2026-11-26T09:00:00Z'),
    t('0002', 'juan dela cruz'),
    t('0003', 'Juan Dela Cruz', '2026-11-26T09:01:00Z'),
    t('0004', 'Ana'),
    t('0005'),
  ])
  expect(counts.get(groupKey('Juan Dela Cruz'))).toEqual({ total: 3, here: 2 })
  expect(counts.get(groupKey('Ana'))).toEqual({ total: 1, here: 0 })
  expect(counts.has('')).toBe(false)
})

test('ticket list: random numbers separated by commas or spaces, zero-padded', () => {
  expect(parseTicketList('12, 57 103')).toEqual({ numbers: ['0012', '0057', '0103'], invalid: [] })
})

test('ticket list: dashes make a run, including en dashes', () => {
  expect(parseTicketList('10-12, 0200–0201')).toEqual({ numbers: ['0010', '0011', '0012', '0200', '0201'], invalid: [] })
  expect(parseTicketList('10 - 12 20 –21')).toEqual({ numbers: ['0010', '0011', '0012', '0020', '0021'], invalid: [] })
})

test('ticket list: repeats are kept once; junk and backwards runs are reported', () => {
  expect(parseTicketList('5, 5, abc, 9-7')).toEqual({ numbers: ['0005'], invalid: ['abc', '9-7'] })
  expect(parseTicketList('  ')).toEqual({ numbers: [], invalid: [] })
})

const list = [t('0000'), t('0001', 'Ana'), t('0002'), t('0003')]

test('plan: tickets already given to someone else are reported, the same person is fine', () => {
  expect(planGive(list, ['0000', '0001', '0002'], 'Juan')).toEqual({
    tickets: ['0000', '0001', '0002'],
    taken: [{ ticket: '0001', name: 'Ana' }],
    missing: [],
  })
  expect(planGive(list, ['0001'], ' ana ').taken).toEqual([])
})

test('plan: numbers that are not in the event are reported as missing', () => {
  expect(planGive(list, ['0003', '0099'], 'Juan')).toEqual({ tickets: ['0003'], taken: [], missing: ['0099'] })
})
