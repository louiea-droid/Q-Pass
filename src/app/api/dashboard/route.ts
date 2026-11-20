import { currentStaff } from '@/lib/guard'
import { getDashboard, getEvent } from '@/lib/store'

export async function GET(request: Request) {
  const staff = await currentStaff()
  if (staff?.role !== 'admin') return Response.json({ error: 'Admins only' }, { status: 401 })
  const event = new URL(request.url).searchParams.get('event') ?? ''
  if (!(await getEvent(event))) return Response.json({ error: 'Event not found' }, { status: 404 })
  try {
    return Response.json(await getDashboard(event))
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 })
  }
}
