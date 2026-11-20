import 'server-only'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { findStaff } from './staff'
import { getStaffList } from './store'
import type { Role, Staff } from './types'

/** Re-checks the Staff tab on every call (cached 60 s), so removing someone takes effect quickly. */
export async function currentStaff(): Promise<Staff | undefined> {
  const email = (await auth())?.user?.email
  return email ? findStaff(await getStaffList(), email) : undefined
}

export async function requireStaff(role: Role = 'scanner'): Promise<Staff> {
  const session = await auth()
  if (!session?.user?.email) redirect('/signin')
  const staff = findStaff(await getStaffList(), session.user.email)
  if (!staff || (role === 'admin' && staff.role !== 'admin')) redirect('/denied')
  return staff
}
