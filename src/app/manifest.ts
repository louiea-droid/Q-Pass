import type { MetadataRoute } from 'next'

// Lets Android Chrome offer "Install app": Q-Pass gets a home-screen icon and opens full screen, without the
// browser bar. "/" sends admins to the desk and volunteers to the scanner (or to sign-in).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Q-Pass',
    short_name: 'Q-Pass',
    description: 'Ticket check-in for church events',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#1b1c1f',
    theme_color: '#1b1c1f',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
