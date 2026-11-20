import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Role, Staff } from './types'

export const SESSION_COOKIE = 'tac_session'
export const SESSION_MS = 12 * 3600_000

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function roleForPasscode(input: string, env: { SCANNER_PASSCODE?: string; ADMIN_PASSCODE?: string }): Role | null {
  const code = input.trim()
  if (!code) return null
  if (env.ADMIN_PASSCODE && same(code, env.ADMIN_PASSCODE)) return 'admin'
  if (env.SCANNER_PASSCODE && same(code, env.SCANNER_PASSCODE)) return 'scanner'
  return null
}

const sign = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('base64url')

export function signSession(s: { name: string; role: Role }, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ name: s.name, role: s.role, exp: now + SESSION_MS })).toString('base64url')
  return `${body}.${sign(body, secret)}`
}

export function verifySession(token: string, secret: string, now = Date.now()): Staff | null {
  const [body, sig] = token.split('.')
  if (!body || !sig || !same(sig, sign(body, secret))) return null
  try {
    const { name, role, exp } = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (typeof exp !== 'number' || now > exp || (role !== 'admin' && role !== 'scanner') || typeof name !== 'string') return null
    return { name, role }
  } catch {
    return null
  }
}
