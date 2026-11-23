import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { expect, test } from 'vitest'
import ArrivalsChart from './ArrivalsChart'

test('server HTML has no clock times, so a UTC server and a local browser render the same (no hydration mismatch)', () => {
  const html = renderToString(createElement(ArrivalsChart, { buckets: [{ start: Date.UTC(2027, 0, 3, 10), count: 2 }] }))
  expect(html).toContain('2') // the chart itself still renders
  expect(html).not.toMatch(/\d{1,2}:\d{2}/)
})
