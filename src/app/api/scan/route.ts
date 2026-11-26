import { currentStaff } from '@/lib/guard'
import { normalizeTicket } from '@/lib/qr'
import { checkIn } from '@/lib/store'
import type { ScanOutcome } from '@/lib/types'

/**
 * One scan from the door phone. A plain request, not a server action: server actions run one at a time per page,
 * so one hung scan on weak Wi-Fi used to hold up every scan after it.
 */
export async function POST(request: Request) {
  const staff = await currentStaff()
  if (!staff) return Response.json({ error: 'Sign in first' }, { status: 401 })
  const { event, value, method, by } = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (typeof event !== 'string' || typeof value !== 'string' || (method !== 'QR' && method !== 'manual'))
    return Response.json({ error: 'Bad scan' }, { status: 400 })
  // A scan saved offline is sent later, maybe after someone else signed in on that phone; `by` keeps the original
  // scanner's name. Names are typed at sign-in and never verified, so this trusts nothing new; the role stays the session's.
  const who = { ...staff, name: (typeof by === 'string' && by.trim().slice(0, 60)) || staff.name }
  try {
    if (method === 'QR') return Response.json(await checkIn({ payload: value, event, staff: who, method }))
    const ticket = normalizeTicket(value)
    if (!ticket) return Response.json({ result: 'not_found', message: 'Type a ticket number, like 0057' } satisfies ScanOutcome)
    return Response.json(await checkIn({ payload: null, event, ticket, staff: who, method }))
  } catch (e) {
    return Response.json({ error: (e as Error).message || 'Couldn’t save' }, { status: 503 })
  }
}
