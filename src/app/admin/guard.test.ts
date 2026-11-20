import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'

// Layouts don't protect pages in Next (a crafted RSC request can render a page alone),
// so every admin page must check the role itself.
const pages = (readdirSync(__dirname, { recursive: true }) as string[])
  .filter((f) => path.basename(f) === 'page.tsx')
  .map((f) => path.join(__dirname, f))

test('there are admin pages to check', () => expect(pages.length).toBeGreaterThanOrEqual(4))

test.each(pages)('%s calls requireStaff("admin")', (file) => {
  expect(readFileSync(file, 'utf8')).toMatch(/await requireStaff\('admin'\)/)
})
