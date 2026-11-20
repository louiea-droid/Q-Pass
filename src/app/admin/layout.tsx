import { requireStaff } from '@/lib/guard'
import Logo from '../Logo'
import { signOutAction } from '../signin/actions'
import AdminNav from './AdminNav'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const staff = await requireStaff('admin')
  return (
    <>
      <header className="no-print border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3.5">
          <span className="flex items-center gap-2.5 text-lg font-extrabold text-primary">
            <Logo size={32} />
            Q-Pass
          </span>
          <AdminNav />
          <form action={signOutAction} className="ml-auto flex min-w-0 items-center gap-3">
            <span className="truncate text-sm text-muted">{staff.name}, admin</span>
            <button className="h-10 shrink-0 rounded-xl border border-line-strong px-3.5 text-sm font-semibold transition-colors duration-200 hover:bg-soft">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pt-7 pb-12">{children}</main>
    </>
  )
}
