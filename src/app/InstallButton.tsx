'use client'

import { useSyncExternalStore } from 'react'

/** Chrome's install offer. The inline script in layout.tsx keeps it on `window`, since it can arrive before React loads. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
declare global {
  interface Window {
    __installPrompt?: InstallPrompt | null
  }
}

const READY = 'qpass-installable'
const subscribe = (onChange: () => void) => {
  window.addEventListener(READY, onChange)
  window.addEventListener('appinstalled', onChange)
  return () => {
    window.removeEventListener(READY, onChange)
    window.removeEventListener('appinstalled', onChange)
  }
}

/**
 * "Install Q-Pass": opens Android's install prompt in one tap. Shows only when the browser can install right now,
 * so it is hidden once installed, inside the installed app, and on iPhones (Safari has no install prompt).
 */
export default function InstallButton({ className }: { className: string }) {
  const canInstall = useSyncExternalStore(subscribe, () => !!window.__installPrompt, () => false)
  if (!canInstall) return null
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const offer = window.__installPrompt
        if (!offer) return
        await offer.prompt()
        await offer.userChoice
        // The offer can be used only once; Chrome sends a new one later if they said no.
        window.__installPrompt = null
        window.dispatchEvent(new Event(READY))
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </svg>
      Install Q-Pass
    </button>
  )
}
