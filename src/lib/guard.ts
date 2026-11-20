import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySession } from './session'
import type { Role, Staff } from './types'

export function sessionSecret(): string {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set to a random value of at least 32 characters')
  return s
}

export async function currentStaff(): Promise<Staff | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return (token && verifySession(token, sessionSecret())) || undefined
}

export async function requireStaff(role: Role = 'scanner'): Promise<Staff> {
  const staff = await currentStaff()
  if (!staff) redirect('/signin')
  if (role === 'admin' && staff.role !== 'admin') redirect('/denied')
  return staff
}
