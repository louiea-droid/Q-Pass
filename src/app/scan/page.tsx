import { requireStaff } from '@/lib/guard'
import { listEvents } from '@/lib/store'
import Scanner from './Scanner'

export const metadata = { title: 'Scan tickets · TAC Check-in' }

export default async function ScanPage() {
  const staff = await requireStaff('scanner')
  const events = (await listEvents()).filter((e) => e.status === 'open').map((e) => e.name)
  return <Scanner events={events} staff={staff} />
}
