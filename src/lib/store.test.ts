import { beforeEach, expect, test, vi } from 'vitest'

// Fake Google Sheets API: just enough of the surface store.ts uses.
const fake = vi.hoisted(() => {
  const state = {
    values: {} as Record<string, string[][]>,
    appendFails: false,
    batchUpdates: [] as unknown[],
    updates: [] as { range: string; values: string[][] }[],
  }
  const api = {
    spreadsheets: {
      get: async () => ({ data: { sheets: [] } }),
      batchUpdate: async ({ requestBody }: { requestBody: unknown }) => {
        state.batchUpdates.push(requestBody)
        return { data: {} }
      },
      values: {
        get: async ({ range }: { range: string }) => ({ data: { values: state.values[range] ?? [] } }),
        update: async ({ range, requestBody }: { range: string; requestBody: { values: string[][] } }) => {
          state.updates.push({ range, values: requestBody.values })
          return { data: {} }
        },
        append: async () => {
          if (state.appendFails) throw Object.assign(new Error('quota'), { code: 429 })
          return { data: {} }
        },
      },
    },
  }
  return { state, api }
})

vi.mock('server-only', () => ({}))
vi.mock('@googleapis/sheets', () => ({ auth: { JWT: class {} }, sheets: () => fake.api }))

const staff = { email: 'maria@church.org', name: 'Maria', role: 'scanner' as const }

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 1000 })
  fake.state.values = {
    'Events!A2:G': [['TAC Gala', '', '', '', '0000', '1000', 'open']],
    "'TAC Gala'!A2:G": [['0001', 'Juan', '', '', '', '', '']],
  }
  fake.state.appendFails = false
  fake.state.batchUpdates = []
  fake.state.updates = []
})

test('a check-in still succeeds when only the Log write fails', async () => {
  const { checkIn } = await import('./store')
  fake.state.appendFails = true
  const r = await checkIn({ payload: 'TAC Gala-0001', event: 'TAC Gala', staff, method: 'QR' })
  expect(r.result).toBe('checked_in')
  expect(fake.state.updates.some((u) => u.range === "'TAC Gala'!E2:G2")).toBe(true)
})

test('a new event tab is created with enough rows for every ticket', async () => {
  const { createEvent } = await import('./store')
  fake.state.values['Events!A2:G'] = []
  await createEvent({ name: 'New Event', date: '', venue: '', details: '', ticketFrom: '0000', ticketTo: '1000', status: 'open' })
  const req = JSON.stringify(fake.state.batchUpdates[0])
  const rows = Number(/"rowCount":(\d+)/.exec(req)?.[1] ?? 0)
  expect(rows).toBeGreaterThanOrEqual(1002) // header + 1,001 tickets
})
