import { expect, test } from 'vitest'
import { firstFreeRun, groupCounts, groupKey, planGive } from './groups'

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

const list = [t('0000'), t('0001', 'Ana'), t('0002'), t('0003'), t('0004'), t('0005'), t('0006')]

test('first free run finds the first block of consecutive free tickets', () => {
  expect(firstFreeRun(list, 1)).toBe('0000')
  expect(firstFreeRun(list, 3)).toBe('0002')
  expect(firstFreeRun(list, 6)).toBeNull()
})

test('plan: the numbers to give, starting at a ticket', () => {
  expect(planGive(list, '0002', 3, 'Juan')).toEqual({ tickets: ['0002', '0003', '0004'], taken: [], missing: [] })
})

test('plan: tickets already given to someone else are reported, the same person is fine', () => {
  expect(planGive(list, '0000', 3, 'Juan').taken).toEqual([{ ticket: '0001', name: 'Ana' }])
  expect(planGive(list, '0000', 3, ' ana ').taken).toEqual([])
})

test('plan: numbers past the end of the event are reported as missing', () => {
  expect(planGive(list, '0005', 4, 'Juan').missing).toEqual(['0007', '0008'])
})
