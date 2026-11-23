'use client'

import { usePathname, useRouter } from 'next/navigation'
import Select from '../Select'

/** "Switch event" selector for admin pages; keeps the choice in ?event= so it survives reloads and links. */
export default function EventPicker({ events, value }: { events: string[]; value: string }) {
  const router = useRouter()
  const path = usePathname()
  if (events.length < 2) return null
  return (
    <Select
      label="Switch event"
      value={value}
      onChange={(e) => router.push(`${path}?event=${encodeURIComponent(e.target.value)}`)}
      className="max-w-72"
      icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
        </svg>
      }
    >
      {events.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </Select>
  )
}
