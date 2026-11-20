import { requireStaff } from '@/lib/guard'
import AdminHeader from './AdminHeader'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const staff = await requireStaff('admin')
  return (
    <>
      <AdminHeader staff={staff} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pt-4 pb-32 sm:px-6 sm:pt-6 lg:pb-12">{children}</main>
    </>
  )
}
