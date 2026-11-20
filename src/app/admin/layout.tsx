import Link from 'next/link'
import { requireStaff } from '@/lib/guard'

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/people', label: 'People' },
  { href: '/admin/events', label: 'Events' },
  { href: '/scan', label: 'Scanner' },
]

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  await requireStaff('admin')
  return (
    <>
      <nav aria-label="Admin" className="no-print -mt-2 mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 px-3 py-2 text-muted hover:text-ink">
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  )
}
