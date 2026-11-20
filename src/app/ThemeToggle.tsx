'use client'

import { useSyncExternalStore } from 'react'

const isDark = () => document.documentElement.dataset.theme === 'dark'
const subscribe = (onChange: () => void) => {
  const o = new MutationObserver(onChange)
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => o.disconnect()
}

/** Light/dark switch. Shows a moon in light mode and a sun in dark mode; the choice is remembered on this device. */
export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false)
  return (
    <button
      type="button"
      onClick={() => {
        const next = isDark() ? 'light' : 'dark'
        document.documentElement.dataset.theme = next
        try {
          localStorage.setItem('theme', next)
        } catch {}
      }}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="theme-toggle size-10 shrink-0 rounded-full border border-line-strong bg-surface text-ink transition-colors duration-200 hover:bg-soft"
    >
      <svg className="icon--moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      <svg className="icon--sun text-gold" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  )
}
