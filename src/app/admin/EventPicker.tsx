'use client'

import { usePathname, useRouter } from 'next/navigation'

/** "Switch event" selector for admin pages; keeps the choice in ?event= so it survives reloads and links. */
export default function EventPicker({ events, value }: { events: string[]; value: string }) {
  const router = useRouter()
  const path = usePathname()
  if (events.length < 2) return null
  return (
    <label className="relative flex h-11 items-center rounded-xl border border-line-strong bg-surface">
      <span className="sr-only">Switch event</span>
      <select
        value={value}
        onChange={(e) => router.push(`${path}?event=${encodeURIComponent(e.target.value)}`)}
        className="h-full max-w-64 appearance-none truncate rounded-xl bg-transparent pr-9 pl-4 font-semibold"
      >
        {events.map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-3 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  )
}
