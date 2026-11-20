import { expect, test } from 'vitest'
import { headline } from './display'

test('a named ticket is headed by the name', () => {
  expect(headline({ ticket: '0057', name: 'Juan Dela Cruz' })).toBe('Juan Dela Cruz')
})

test('a ticket without a name is headed by its number, never "no name"', () => {
  expect(headline({ ticket: '0057', name: '' })).toBe('Ticket 0057')
  expect(headline({ ticket: '0057', name: '   ' })).toBe('Ticket 0057')
  expect(headline({ ticket: '0057' })).toBe('Ticket 0057')
})
