import type { Metadata, Viewport } from 'next'
import { Figtree, Literata } from 'next/font/google'
import Link from 'next/link'
import { signOutAction } from './signin/actions'
import { currentStaff } from '@/lib/guard'
import './globals.css'

const figtree = Figtree({ variable: '--font-figtree', subsets: ['latin'] })
const literata = Literata({ variable: '--font-literata', subsets: ['latin'] })

export const metadata: Metadata = { title: 'TAC Check-in', description: 'Ticket check-in for TAC events' }
export const viewport: Viewport = { themeColor: '#1f4a36' }

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const staff = await currentStaff().catch(() => undefined)
  return (
    <html lang="en" className={`${figtree.variable} ${literata.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="no-print border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="font-serif text-lg font-semibold text-pine">
              TAC Check-in
            </Link>
            {staff && (
              <form
                className="ml-auto flex min-w-0 items-center gap-3 text-sm"
                action={signOutAction}
              >
                <span className="truncate text-muted" title={staff.name}>
                  {staff.name} ({staff.role})
                </span>
                <button className="shrink-0 rounded-md border border-line px-3 py-1.5 hover:bg-paper">Sign out</button>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
