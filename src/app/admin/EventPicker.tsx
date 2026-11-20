'use client'

import { usePathname, useRouter } from 'next/navigation'

/** Event selector shared by admin pages; keeps the choice in ?event= so it survives reloads and links. */
export default function EventPicker({ events, value }: { events: string[]; value: string }) {
  const router = useRouter()
  const path = usePathname()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor="admin-event" className="shrink-0 text-sm font-semibold">
        Event
      </label>
      <select
        id="admin-event"
        value={value}
        onChange={(e) => router.push(`${path}?event=${encodeURIComponent(e.target.value)}`)}
        className="min-w-0 rounded-md border border-line bg-surface px-3 py-2"
      >
        {events.map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
    </div>
  )
}
