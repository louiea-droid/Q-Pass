import { requireStaff } from '@/lib/guard'
import Logo from '../Logo'
import { signOutAction } from '../signin/actions'
import AdminNav from './AdminNav'
import ThemeToggle from '../ThemeToggle'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const staff = await requireStaff('admin')
  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-2.5 pb-1.5 sm:px-6 sm:py-3">
          <span className="flex items-center gap-2.5 text-lg font-extrabold text-primary">
            <Logo size={30} />
            Q-Pass
          </span>
          {/* Phone: logo and buttons on one row, the menu on a swipeable row below. Wider: one row. */}
          <form action={signOutAction} className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3 lg:order-last">
            <ThemeToggle />
            <span className="hidden truncate text-sm text-muted sm:inline">{staff.name}, admin</span>
            <button className="h-10 shrink-0 rounded-full border border-line-strong px-3.5 text-sm font-semibold transition-colors duration-200 hover:bg-soft">
              Sign out
            </button>
          </form>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pt-4 pb-12 sm:px-6 sm:pt-6">{children}</main>
    </>
  )
}
