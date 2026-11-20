import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] })

export const metadata: Metadata = { title: 'Q-Pass', description: 'Ticket check-in for church events' }
export const viewport: Viewport = { themeColor: '#2e3a87' }

// Each area draws its own header: the scanner a compact phone bar, the admin desk a full nav.
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  )
}
