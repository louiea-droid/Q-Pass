import { requireStaff } from '@/lib/guard'
import { listEvents } from '@/lib/store'
import Scanner from './Scanner'
import AdminHeader from '../admin/AdminHeader'

export const metadata = { title: 'Scan tickets · Q-Pass' }

export default async function ScanPage() {
  const staff = await requireStaff('scanner')
  const events = (await listEvents()).filter((e) => e.status === 'open').map((e) => e.name)
  return (
    <>
      {/* On computers admins get the usual admin header; phones keep the scanner's own compact bar. */}
      {staff.role === 'admin' && (
        <div className="hidden lg:block">
          <AdminHeader staff={staff} />
        </div>
      )}
      <Scanner events={events} staff={staff} />
    </>
  )
}
