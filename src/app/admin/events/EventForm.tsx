'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createEventAction, updateEventAction } from '../../actions'
import { isValidEventName, normalizeTicket } from '@/lib/qr'
import type { EventInfo } from '@/lib/types'

const input = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2'

export function CreateEventForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [pending, start] = useTransition()
  const nameProblem = name && !isValidEventName(name.trim()) ? 'Use letters, numbers, spaces and dashes, up to 40 characters.' : ''

  return (
    <form
      className="h-fit rounded-xl border border-line bg-surface p-4"
      onSubmit={(ev) => {
        ev.preventDefault()
        const f = new FormData(ev.currentTarget)
        const from = normalizeTicket(String(f.get('from')))
        const to = normalizeTicket(String(f.get('to')))
        if (!from || !to || Number(from) > Number(to)) return setError('Ticket range must be numbers from 0000 to 9999, first ≤ last.')
        const form = ev.currentTarget
        start(async () => {
          setError('')
          const r = await createEventAction({
            name, date: String(f.get('date')), venue: String(f.get('venue')), details: String(f.get('details')),
            ticketFrom: from, ticketTo: to, status: 'open',
          }).catch(() => ({ error: 'Couldn’t create the event. Check the connection and try again.' }))
          if (r.error) return setError(r.error)
          setDone(`Created ${name.trim()}.`)
          setName('')
          form.reset()
          router.refresh()
        })
      }}
    >
      <h2 className="font-serif text-xl font-semibold">New event</h2>
      <label className="mt-3 block text-sm font-semibold">
        Event name
        <input
          name="name"
          required
          maxLength={40}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setDone('')
          }}
          aria-invalid={!!nameProblem}
          aria-describedby="name-help"
          placeholder="TAC Thanksgiving 2026"
          className={input}
        />
      </label>
      <p id="name-help" className={`mt-1 text-xs ${nameProblem ? 'text-bad' : 'text-muted'}`}>
        {nameProblem || 'This goes inside every QR code, so it can’t be changed after the event is created.'}
      </p>
      <label className="mt-3 block text-sm font-semibold">
        Date
        <input name="date" type="date" className={input} />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Venue
        <input name="venue" className={input} />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Details
        <textarea name="details" rows={2} className={input} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold">
          First ticket
          <input name="from" inputMode="numeric" defaultValue="0000" required className={`${input} tabular-nums`} />
        </label>
        <label className="block text-sm font-semibold">
          Last ticket
          <input name="to" inputMode="numeric" defaultValue="1000" required className={`${input} tabular-nums`} />
        </label>
      </div>
      <button
        disabled={pending || !!nameProblem || !name.trim()}
        className="mt-4 w-full rounded-lg bg-pine px-4 py-2 font-semibold text-pine-ink disabled:opacity-60"
      >
        {pending ? 'Creating tickets…' : 'Create event'}
      </button>
      <p role="status" className="mt-2 text-sm">
        {error ? <span className="text-bad">{error}</span> : done}
      </p>
    </form>
  )
}

export function EditEvent({ event }: { event: EventInfo }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [pending, start] = useTransition()

  const save = (patch: Partial<Omit<EventInfo, 'name'>>, msg: string) =>
    start(async () => {
      setError('')
      setSaved('')
      const r = await updateEventAction(event.name, patch).catch(() => ({ error: 'Couldn’t save. Try again.' }))
      if (r.error) return setError(r.error)
      setSaved(msg)
      router.refresh()
    })

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold">Edit details</summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(ev) => {
          ev.preventDefault()
          const f = new FormData(ev.currentTarget)
          save({ date: String(f.get('date')), venue: String(f.get('venue')), details: String(f.get('details')) }, 'Saved.')
        }}
      >
        <label className="text-sm font-semibold">
          Date
          <input name="date" type="date" defaultValue={event.date} className={input} />
        </label>
        <label className="text-sm font-semibold">
          Venue
          <input name="venue" defaultValue={event.venue} className={input} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Details
          <textarea name="details" rows={2} defaultValue={event.details} className={input} />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button disabled={pending} className="rounded-md bg-pine px-4 py-2 font-semibold text-pine-ink disabled:opacity-60">
            {pending ? 'Saving…' : 'Save details'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const closing = event.status === 'open'
              if (!closing || confirm(`Close ${event.name}? Scanners will reject its tickets until you reopen it.`))
                save({ status: closing ? 'closed' : 'open' }, closing ? 'Event closed.' : 'Event reopened.')
            }}
            className="rounded-md border border-line px-4 py-2 disabled:opacity-60"
          >
            {event.status === 'open' ? 'Close event' : 'Reopen event'}
          </button>
          <span role="status" className="text-sm">
            {error ? <span className="text-bad">{error}</span> : saved}
          </span>
        </div>
      </form>
    </details>
  )
}
