import { currentStaff } from '@/lib/guard'
import { getDashboard, getEvent } from '@/lib/store'

/** Live "N checked in" for the scanner header. Any signed-in staff. */
export async function GET(request: Request) {
  if (!(await currentStaff())) return Response.json({ error: 'Sign in first' }, { status: 401 })
  const event = new URL(request.url).searchParams.get('event') ?? ''
  if (!(await getEvent(event))) return Response.json({ error: 'Event not found' }, { status: 404 })
  try {
    return Response.json({ checkedIn: (await getDashboard(event)).checkedIn })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 })
  }
}
