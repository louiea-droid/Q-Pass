import { expect, test } from 'vitest'
import { roleForPasscode, signSession, verifySession } from './session'

const SECRET = 'a-long-random-secret-for-tests-only'
const env = { SCANNER_PASSCODE: 'harvest-17', ADMIN_PASSCODE: 'sunrise-42' }

test('passcodes map to roles; anything else is refused', () => {
  expect(roleForPasscode('sunrise-42', env)).toBe('admin')
  expect(roleForPasscode(' harvest-17 ', env)).toBe('scanner')
  expect(roleForPasscode('Harvest-17', env)).toBeNull()
  expect(roleForPasscode('', env)).toBeNull()
})

test('an unset passcode never matches (empty input cannot log in)', () => {
  expect(roleForPasscode('', { SCANNER_PASSCODE: '', ADMIN_PASSCODE: undefined })).toBeNull()
  expect(roleForPasscode('x', { SCANNER_PASSCODE: '', ADMIN_PASSCODE: undefined })).toBeNull()
})

test('a signed session round-trips', () => {
  const token = signSession({ name: 'Ana', role: 'scanner' }, SECRET, 1_000)
  expect(verifySession(token, SECRET, 2_000)).toEqual({ name: 'Ana', role: 'scanner' })
})

test('a tampered session is rejected', () => {
  const token = signSession({ name: 'Ana', role: 'scanner' }, SECRET, 1_000)
  const [body, sig] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ name: 'Ana', role: 'admin', exp: 9e15 })).toString('base64url')
  expect(verifySession(`${forged}.${sig}`, SECRET, 2_000)).toBeNull()
  expect(verifySession(`${body}.${sig}x`, SECRET, 2_000)).toBeNull()
  expect(verifySession(token, 'other-secret-xxxxxxxxxxxxxxxx', 2_000)).toBeNull()
  expect(verifySession('garbage', SECRET, 2_000)).toBeNull()
})

test('a session expires after 12 hours', () => {
  const token = signSession({ name: 'Ana', role: 'admin' }, SECRET, 0)
  expect(verifySession(token, SECRET, 12 * 3600_000 - 1)).not.toBeNull()
  expect(verifySession(token, SECRET, 12 * 3600_000 + 1)).toBeNull()
})
