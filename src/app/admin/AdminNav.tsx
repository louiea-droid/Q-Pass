'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin', label: 'Check-in desk' },
  { href: '/admin/tickets', label: 'Tickets' },
  { href: '/admin/qr', label: 'QR codes' },
  { href: '/admin/events', label: 'Events' },
  { href: '/scan', label: 'Scanner' },
]

export default function AdminNav() {
  const path = usePathname()
  const current = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href))
  return (
    <nav aria-label="Admin" className="-mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:px-0 lg:pb-0">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={current(n.href) ? 'page' : undefined}
          className={`shrink-0 rounded-lg px-3 py-2 text-[15px] font-semibold whitespace-nowrap transition-colors duration-200 ${
            current(n.href) ? 'bg-soft text-primary' : 'text-muted hover:bg-soft hover:text-ink'
          }`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  )
}
