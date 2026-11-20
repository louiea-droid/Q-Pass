'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sessionSecret } from '@/lib/guard'
import { roleForPasscode, SESSION_COOKIE, SESSION_MS, signSession } from '@/lib/session'

export async function signInAction(_prev: { error?: string; name?: string }, form: FormData): Promise<{ error?: string; name?: string }> {
  const name = String(form.get('name') ?? '').trim().slice(0, 60)
  if (!name) return { error: 'Type your name so check-ins show who scanned them.' }
  const { SCANNER_PASSCODE, ADMIN_PASSCODE } = process.env
  const role = roleForPasscode(String(form.get('passcode') ?? ''), { SCANNER_PASSCODE, ADMIN_PASSCODE })
  if (!role) {
    await new Promise((r) => setTimeout(r, 1000)) // slows down guessing
    return { error: 'That passcode isn’t right. Ask an admin for the current one.', name }
  }
  ;(await cookies()).set(SESSION_COOKIE, signSession({ name, role }, sessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MS / 1000,
  })
  redirect(role === 'admin' ? '/admin' : '/scan')
}

export async function signOutAction() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect('/signin')
}
