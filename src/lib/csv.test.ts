import { expect, test } from 'vitest'
import { ticketsCsv } from './csv'

const t = (o: Partial<Record<string, string>>) => ({
  ticket: '0001', name: '', info: '', notes: '', checkedInAt: '', checkedInBy: '', method: '' as const, ...o,
})

test('header row then one row per ticket, leading zeros kept as text', () => {
  const csv = ticketsCsv([t({ name: 'Juan' })])
  expect(csv.split('\r\n')[0]).toBe('Ticket,Name,Info,Notes,CheckedInAt,CheckedInBy,Method')
  expect(csv.split('\r\n')[1]).toBe('="0001",Juan,,,,,')
})

test('commas, quotes and line breaks are quoted', () => {
  expect(ticketsCsv([t({ name: 'Cruz, Juan "JC"', notes: 'line1\nline2' })]).split('\r\n').slice(1).join('\r\n')).toBe(
    '="0001","Cruz, Juan ""JC""",,"line1\nline2",,,',
  )
})

test('values that a spreadsheet would run as formulas are neutralised', () => {
  const line = ticketsCsv([t({ name: '=HYPERLINK("x")', info: '+1', notes: '@cmd' })]).split('\r\n')[1]
  expect(line).toBe('="0001","\'=HYPERLINK(""x"")",\'+1,\'@cmd,,,')
})
