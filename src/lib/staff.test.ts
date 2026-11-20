import { expect, test } from 'vitest'
import { findStaff, parseStaffRows } from './staff'

const rows = [
  ['Email', 'Name', 'Role', 'Active'],
  [' Maria@Church.org ', 'Maria', 'Admin', 'TRUE'],
  ['ana@church.org', 'Ana', 'scanner', 'true'],
  ['off@church.org', 'Off', 'scanner', 'FALSE'],
  ['blank@church.org', 'Blank', 'scanner', ''],
  ['owner@church.org', 'Owner', 'owner', 'TRUE'],
]

test('header skipped; only active rows with a known role kept', () => {
  expect(parseStaffRows(rows).map((s) => s.name)).toEqual(['Maria', 'Ana'])
})

test('roles are case-insensitive', () => {
  expect(parseStaffRows(rows)[0].role).toBe('admin')
})

test('email match ignores case and surrounding spaces', () => {
  const list = parseStaffRows(rows)
  expect(findStaff(list, 'maria@church.org')?.name).toBe('Maria')
  expect(findStaff(list, ' ANA@church.org')?.name).toBe('Ana')
  expect(findStaff(list, 'off@church.org')).toBeUndefined()
})
