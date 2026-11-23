import { expect, test } from 'vitest'
import { decodeCsv, parseGuestCsv, planImport, ticketsCsv } from './csv'

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

// ---- Guest list import ----

test('import: header row maps columns by name; ticket numbers are normalized', () => {
  expect(parseGuestCsv('Ticket,Name,Details,Notes\r\n57,Ana Cruz,Table 4,\r\n')).toEqual({
    rows: [{ line: 2, ticket: '0057', name: 'Ana Cruz', info: 'Table 4', notes: '' }],
    badLines: [],
  })
})

test('import: a file exported by this app reads back the same (BOM, ="0001", Info header)', () => {
  const csv = '﻿' + ticketsCsv([t({ name: 'Juan', info: 'VIP' }), t({ ticket: '0002', name: 'Cruz, Ana', notes: '=x' })])
  expect(parseGuestCsv(csv).rows).toEqual([
    { line: 2, ticket: '0001', name: 'Juan', info: 'VIP', notes: '' },
    { line: 3, ticket: '0002', name: 'Cruz, Ana', info: '', notes: '=x' },
  ])
})

test('import: without a header, columns are ticket, name, details, notes', () => {
  expect(parseGuestCsv('0012,Ben').rows).toEqual([{ line: 1, ticket: '0012', name: 'Ben', info: '', notes: '' }])
})

test('import: quoted cells with commas and doubled quotes', () => {
  expect(parseGuestCsv('"0013","Cruz, Ana ""Annie"""').rows[0].name).toBe('Cruz, Ana "Annie"')
})

test('import: CRLF, LF and blank lines all read the same', () => {
  const want = parseGuestCsv('1,A\r\n2,B').rows.map((r) => [r.ticket, r.name])
  expect(parseGuestCsv('1,A\n\n2,B\n').rows.map((r) => [r.ticket, r.name])).toEqual(want)
  expect(parseGuestCsv('1,A\n\n2,B\n').badLines).toEqual([])
})

test('import: lines without a valid ticket number are reported by line number', () => {
  expect(parseGuestCsv('Ticket,Name\nabc,Ana\n12345,Ben\n7,Cy').badLines).toEqual([2, 3])
})

test("import: a name that really starts with ' is kept", () => {
  expect(parseGuestCsv("1,'Tony").rows[0].name).toBe("'Tony")
})

const row = (ticket: string, name = '', info = '', notes = '') => ({ line: 1, ticket, name, info, notes })

test('planImport: tickets not in the event are listed and skipped', () => {
  expect(planImport(['0001'], [row('0001', 'Ana'), row('0999', 'Ben')])).toEqual({
    patches: [{ ticket: '0001', patch: { name: 'Ana' } }],
    unknown: ['0999'],
  })
})

test('planImport: blank cells are left out, so they keep what is there; empty rows are skipped', () => {
  expect(planImport(['0001', '0002'], [row('0001', '', 'VIP'), row('0002')]).patches).toEqual([
    { ticket: '0001', patch: { info: 'VIP' } },
  ])
})

test('planImport: the same ticket twice, the last row wins', () => {
  expect(planImport(['0001'], [row('0001', 'Ana', 'A'), row('0001', 'Ben')]).patches).toEqual([
    { ticket: '0001', patch: { name: 'Ben' } },
  ])
})

test('decodeCsv: UTF-8 files read as UTF-8, Excel’s default Windows-1252 CSV keeps ñ', () => {
  expect(decodeCsv(new TextEncoder().encode('Peña').buffer)).toBe('Peña')
  expect(decodeCsv(new Uint8Array([0x50, 0x65, 0xf1, 0x61]).buffer)).toBe('Peña')
})

test('import: common name headers like "Full Name" and "Guest name" are recognised', () => {
  expect(parseGuestCsv('Ticket No.,Full Name\n5,Ana').rows[0].name).toBe('Ana')
  expect(parseGuestCsv('Ticket,Guest name,Details\n5,Ben,VIP').rows[0]).toMatchObject({ name: 'Ben', info: 'VIP' })
})
