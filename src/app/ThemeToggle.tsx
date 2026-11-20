'use client'

import { useSyncExternalStore } from 'react'

const isDark = () => document.documentElement.dataset.theme === 'dark'
const subscribe = (onChange: () => void) => {
  const o = new MutationObserver(onChange)
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => o.disconnect()
}

// Sun and moon share one grid cell and swap with a spin (adapted from Uiverse.io by Creatlydev).
// Class names are written out in full so Tailwind can find them.

/** Light/dark switch. Shows a moon in light mode and a sun in dark mode; the choice is remembered on this device. */
export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false)
  return (
    <button
      type="button"
      onClick={(e) => {
        const next = isDark() ? 'light' : 'dark'
        const apply = () => {
          document.documentElement.dataset.theme = next
          try {
            localStorage.setItem('theme', next)
          } catch {}
        }
        // The new mode spreads out in a circle from the switch. Instant where unsupported or motion is reduced.
        if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply()
        const { x, y, width, height } = e.currentTarget.getBoundingClientRect()
        const cx = x + width / 2
        const cy = y + height / 2
        const r = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy))
        document.startViewTransition(apply).ready.then(() =>
          document.documentElement.animate(
            { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${r}px at ${cx}px ${cy}px)`] },
            { duration: 550, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' },
          ),
        )
      }}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-line-strong bg-surface text-ink transition-colors duration-200 hover:bg-soft"
    >
      <svg
        className="[grid-area:1/1] transition-transform duration-500 delay-200 [[data-theme=dark]_&]:scale-0 [[data-theme=dark]_&]:rotate-360 [[data-theme=dark]_&]:delay-0"
        width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
      >
        <path fillRule="evenodd" clipRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" />
      </svg>
      <svg
        className="[grid-area:1/1] scale-0 text-gold transition-transform duration-500 [[data-theme=dark]_&]:scale-100 [[data-theme=dark]_&]:rotate-360 [[data-theme=dark]_&]:delay-200"
        width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
      >
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    </button>
  )
}
