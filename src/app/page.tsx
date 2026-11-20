import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/guard'

export default async function Home() {
  const staff = await requireStaff()
  redirect(staff.role === 'admin' ? '/admin' : '/scan')
}
