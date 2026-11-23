import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import Toaster from './toast'

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] })

export const metadata: Metadata = { title: 'Q-Pass', description: 'Ticket check-in for church events' }
export const viewport: Viewport = { themeColor: '#1b1c1f', viewportFit: 'cover' } // cover: lets the bottom bar clear the home indicator

// Each area draws its own header: the scanner a compact phone bar, the admin desk a full nav.
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Set the theme before the first paint: the saved choice, else the device setting. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme')}catch(e){}document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
