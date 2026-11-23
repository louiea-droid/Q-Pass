'use client'

import { useSyncExternalStore } from 'react'

type Toast = { id: number; message: string }

// Module state, so a toast survives page changes (e.g. "Deleted event" after going back to the list).
let toasts: Toast[] = []
let nextId = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const dismiss = (id: number) => {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

/** Short "done" message at the bottom of the screen. Errors stay next to what failed, not here. */
export function toast(message: string) {
  const id = ++nextId
  toasts = [...toasts.slice(-2), { id, message }]
  emit()
  setTimeout(() => dismiss(id), 4000)
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const none: Toast[] = []

export default function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => none)
  return (
    // Above the phone tab bar; bottom-right on desktop.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col items-center gap-2 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-ink py-2.5 pr-2 pl-3 text-[15px] font-semibold text-paper shadow-[0_16px_40px_-12px_rgb(0_0_0/0.5)] transition-[opacity,translate] duration-300 starting:translate-y-3 starting:opacity-0"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-ink" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5 9-10" />
            </svg>
          </span>
          <span className="min-w-0 flex-1 wrap-break-word">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="grid size-8 shrink-0 place-items-center rounded-lg opacity-70 hover:bg-paper/15 hover:opacity-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
