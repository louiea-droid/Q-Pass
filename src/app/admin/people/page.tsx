import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/guard'

// People now lives on the Check-in desk.
export default async function PeoplePage({ searchParams }: PageProps<'/admin/people'>) {
  await requireStaff('admin')
  const { event } = await searchParams
  redirect(typeof event === 'string' ? `/admin?event=${encodeURIComponent(event)}` : '/admin')
}
