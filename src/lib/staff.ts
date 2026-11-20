import type { Role, Staff } from './types'

export function parseStaffRows(rows: string[][]): Staff[] {
  return rows.slice(1).flatMap(([email = '', name = '', role = '', active = '']) => {
    const r = role.trim().toLowerCase()
    if (active.trim().toUpperCase() !== 'TRUE' || (r !== 'admin' && r !== 'scanner') || !email.trim()) return []
    return [{ email: email.trim().toLowerCase(), name: name.trim(), role: r as Role }]
  })
}

export const findStaff = (list: Staff[], email: string) =>
  list.find((s) => s.email === email.trim().toLowerCase())
