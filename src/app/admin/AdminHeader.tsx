import Logo from '../Logo'
import SignOutButton from '../SignOutButton'
import ThemeToggle from '../ThemeToggle'
import type { Staff } from '@/lib/types'
import AdminNav from './AdminNav'

/** The admin header: logo, menu, light/dark switch and Sign out. Used by the admin pages and, on computers, the scanner. */
export default function AdminHeader({ staff }: { staff: Staff }) {
  return (
    <header className="no-print z-30 border-b border-line bg-surface/95 lg:sticky lg:top-0 lg:backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4 py-2.5 sm:px-6 lg:py-3">
        <span className="flex items-center gap-3 text-xl font-extrabold text-primary">
          <Logo size={40} />
          Q-Pass
        </span>
        {/* Below desktop width the menu is a floating bar at the bottom (AdminNav), so this stays one slim row.
            No blur on the header there: it would pin that fixed bar to the header instead of the screen. */}
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3 lg:order-last">
          <ThemeToggle />
          <span className="hidden truncate text-sm text-muted sm:inline">{staff.name}, admin</span>
          <SignOutButton className="h-10 shrink-0 rounded-full border border-line-strong px-3.5 text-sm font-semibold transition-colors duration-200 hover:bg-soft" />
        </div>
        <AdminNav />
      </div>
    </header>
  )
}
