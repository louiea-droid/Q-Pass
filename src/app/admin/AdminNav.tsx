'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin', label: 'Check-in desk' },
  { href: '/admin/events', label: 'Events and QR codes' },
  { href: '/scan', label: 'Open scanner' },
]

export default function AdminNav() {
  const path = usePathname()
  const current = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href))
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-1">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={current(n.href) ? 'page' : undefined}
          className={`rounded-xl px-3.5 py-2.5 font-semibold transition-colors duration-200 ${
            current(n.href) ? 'bg-soft text-primary' : 'text-muted hover:bg-soft hover:text-ink'
          }`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  )
}
