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

/** Emails in ADMIN_EMAILS (comma-separated) are always admins, so the first admin can sign in before the Staff tab is filled. */
export function withEnvAdmins(list: Staff[], envValue: string | undefined): Staff[] {
  const admins = (envValue ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  const merged = list.map((s) => (admins.includes(s.email) ? { ...s, role: 'admin' as const } : s))
  for (const email of admins) if (!merged.some((s) => s.email === email)) merged.push({ email, name: email.split('@')[0], role: 'admin' })
  return merged
}
