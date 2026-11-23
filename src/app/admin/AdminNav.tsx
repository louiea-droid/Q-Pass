'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const svg = (d: React.ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

const NAV = [
  {
    href: '/admin',
    label: 'Check-in desk',
    short: 'Desk',
    icon: svg(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  },
  {
    href: '/admin/tickets',
    label: 'Tickets',
    short: 'Tickets',
    icon: svg(<><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 17v2M13 11v2" /></>),
  },
  {
    href: '/admin/qr',
    label: 'QR codes',
    short: 'QR codes',
    icon: svg(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></>),
  },
  {
    href: '/admin/events',
    label: 'Events',
    short: 'Events',
    icon: svg(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>),
  },
  {
    href: '/scan',
    label: 'Scanner',
    short: 'Scanner',
    icon: svg(<><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" /></>),
  },
]

/** Desktop: a row of links in the header. Phones and tablets: the floating TabBar at the bottom of the screen. */
export default function AdminNav() {
  const path = usePathname()
  const current = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href))
  return (
    <>
      <nav aria-label="Admin" className="hidden gap-1 lg:flex">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={current(n.href) ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-[15px] font-semibold whitespace-nowrap transition-colors duration-200 ${
              current(n.href) ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-soft hover:text-ink'
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <TabBar className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg shadow-[0_10px_30px_-8px_rgb(0_0_0/0.35)] lg:hidden" />
    </>
  )
}

/** The five admin pages as icon tabs. Floating on admin pages (phones and tablets); in the scanner footer for admins. */
export function TabBar({ className = '' }: { className?: string }) {
  const path = usePathname()
  const current = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href))
  return (
    <nav aria-label="Admin" className={`grid grid-cols-5 gap-1 rounded-2xl border border-line-strong bg-surface/90 p-1.5 backdrop-blur-md ${className}`}>
      {NAV.map((n) => {
        const on = current(n.href)
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? 'page' : undefined}
            className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-bold transition-colors duration-200 ${
              on ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-soft hover:text-ink'
            }`}
          >
            {n.icon}
            <span className="whitespace-nowrap">{n.short}</span>
          </Link>
        )
      })}
    </nav>
  )
}
