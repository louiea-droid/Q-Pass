import { describe, expect, test } from 'vitest'
import { isValidEventName, makePayload, normalizeTicket, parsePayload, ticketRange } from './qr'

describe('normalizeTicket', () => {
  test('pads numbers Sheets stored without zeros', () => expect(normalizeTicket(1)).toBe('0001'))
  test('pads typed short numbers', () => expect(normalizeTicket('57')).toBe('0057'))
  test('keeps 4-digit tickets', () => {
    expect(normalizeTicket('0001')).toBe('0001')
    expect(normalizeTicket('1000')).toBe('1000')
  })
  test('rejects non-digits, too long, empty', () => {
    expect(normalizeTicket('abc')).toBeNull()
    expect(normalizeTicket('12345')).toBeNull()
    expect(normalizeTicket('')).toBeNull()
  })
})

describe('parsePayload', () => {
  test('splits event and ticket', () =>
    expect(parsePayload('TAC Thanksgiving 2026-0001')).toEqual({ event: 'TAC Thanksgiving 2026', ticket: '0001' }))
  test('event names containing a dash split on the last dash', () =>
    expect(parsePayload('Youth-Night 2026-0042')).toEqual({ event: 'Youth-Night 2026', ticket: '0042' }))
  test('non-ticket QR codes are rejected', () => {
    expect(parsePayload('https://example.com')).toBeNull()
    expect(parsePayload('0001')).toBeNull()
  })
  test('round-trips makePayload', () =>
    expect(parsePayload(makePayload('TAC Gala', '0007'))).toEqual({ event: 'TAC Gala', ticket: '0007' }))
})

describe('isValidEventName', () => {
  test('accepts a normal name', () => expect(isValidEventName('TAC Thanksgiving 2026')).toBe(true))
  test('rejects empty, reserved tab names, too long, bad characters', () => {
    expect(isValidEventName('')).toBe(false)
    expect(isValidEventName('Log')).toBe(false)
    expect(isValidEventName('staff')).toBe(false)
    expect(isValidEventName('a'.repeat(41))).toBe(false)
    expect(isValidEventName('Gala/2026')).toBe(false)
  })
})

test('ticketRange lists every padded number inclusive', () =>
  expect(ticketRange('0000', '0003')).toEqual(['0000', '0001', '0002', '0003']))
