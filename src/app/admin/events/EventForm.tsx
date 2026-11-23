'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createEventAction, updateEventAction } from '../../actions'
import { isValidEventName, normalizeTicket } from '@/lib/qr'
import type { EventInfo } from '@/lib/types'

const input =
  'h-10 w-full rounded-lg border border-line-strong bg-paper px-3 text-[15px] font-medium text-ink focus:border-primary focus:outline-none'
const label = 'flex flex-col gap-1 text-sm font-bold'
const secondary = 'flex h-10 items-center rounded-lg border border-line-strong px-3.5 text-[15px] font-semibold transition-colors duration-200 hover:bg-soft disabled:opacity-60'
const primary = 'flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-[15px] font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover disabled:opacity-60'

/** "New event": a button that opens the form, or the form straight away for a first event. */
export function NewEvent({ startOpen = false }: { startOpen?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(startOpen)
  const [name, setName] = useState('')
  const [range, setRange] = useState({ from: '0000', to: '1000' })
  const [error, setError] = useState('')
  const [created, setCreated] = useState('')
  const [pending, start] = useTransition()

  const nameProblem = name.trim() && !isValidEventName(name.trim()) ? 'Use only letters, numbers, spaces and dashes (up to 40).' : ''
  const from = normalizeTicket(range.from)
  const to = normalizeTicket(range.to)
  const rangeProblem = !from || !to ? 'Use ticket numbers from 0000 to 9999.' : Number(from) > Number(to) ? 'The first ticket must come before the last.' : ''
  const count = !rangeProblem ? Number(to) - Number(from) + 1 : 0

  if (created && !open)
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-ok/40 bg-ok/10 p-4">
        <p className="min-w-0 flex-1 font-semibold">
          Created <strong>{created}</strong>. Next, download its QR codes.
        </p>
        <Link href={`/admin/qr?event=${encodeURIComponent(created)}`} className={primary}>
          QR codes
        </Link>
        <button onClick={() => setCreated('')} className={secondary}>
          Done
        </button>
      </div>
    )

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className={`${primary} w-fit gap-2`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New event
      </button>
    )

  return (
    <form
      className="flex max-w-2xl flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"
      onSubmit={(ev) => {
        ev.preventDefault()
        if (!name.trim()) return setError('Type the event name first.')
        if (nameProblem || rangeProblem) return setError(nameProblem || rangeProblem)
        const f = new FormData(ev.currentTarget)
        start(async () => {
          setError('')
          const r = await createEventAction({
            name: name.trim(), date: String(f.get('date')), venue: String(f.get('venue')), details: String(f.get('details')),
            ticketFrom: from!, ticketTo: to!, status: 'open',
          }).catch(() => ({ error: 'Couldn’t create the event. Check the connection and try again.' }))
          if (r.error) return setError(r.error)
          setCreated(name.trim())
          setName('')
          setRange({ from: '0000', to: '1000' })
          setOpen(false)
          router.refresh()
        })
      }}
    >
      <h2 className="text-lg font-extrabold">New event</h2>

      <div className="flex flex-col gap-1.5">
        <label className={label}>
          Event name
          <input
            name="name"
            maxLength={40}
            autoFocus={!startOpen}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            aria-invalid={!!nameProblem}
            aria-describedby="name-help"
            className={`${input} h-11 text-base`}
          />
        </label>
        <p id="name-help" className={`text-xs ${nameProblem ? 'font-semibold text-bad-text' : 'text-muted'}`}>
          {nameProblem || 'It’s printed inside every QR code, so it can’t be changed later.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Date
          <input name="date" type="date" className={input} />
        </label>
        <label className={label}>
          Venue
          <input name="venue" autoComplete="off" className={input} />
        </label>
      </div>

      <label className={label}>
        <span>
          Details <span className="font-medium text-muted">(optional)</span>
        </span>
        <textarea name="details" rows={1} className={`${input} h-auto py-2`} />
      </label>

      <fieldset className="flex flex-col gap-1.5 rounded-xl bg-soft p-3">
        <legend className="float-left mb-1 text-sm font-bold">Ticket numbers</legend>
        <div className="clear-both flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            From
            <input
              inputMode="numeric"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
              className={`${input.replace('w-full', 'w-28')} tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            To
            <input
              inputMode="numeric"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
              className={`${input.replace('w-full', 'w-28')} tabular-nums`}
            />
          </label>
          <p aria-live="polite" className={`pb-2.5 text-sm ${rangeProblem ? 'font-semibold text-bad-text' : 'text-muted'}`}>
            {rangeProblem || (
              <>
                That’s <strong className="text-ink">{count.toLocaleString('en')}</strong> tickets.
              </>
            )}
          </p>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="font-semibold text-bad-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} className={`${primary} min-w-40`}>
          {pending ? 'Creating tickets…' : 'Create event'}
        </button>
        {!startOpen && (
          <button type="button" disabled={pending} onClick={() => setOpen(false)} className={secondary}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

/** Event settings: details on the left, open/closed status on the right (same columns as the report above). */
export function EditEvent({ event }: { event: EventInfo }) {
  const router = useRouter()
  const [error, setError] = useState<{ where: 'details' | 'status'; text: string } | null>(null)
  const [saved, setSaved] = useState('')
  const [dirty, setDirty] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const open = event.status === 'open'

  const save = (patch: Partial<Omit<EventInfo, 'name'>>, where: 'details' | 'status') =>
    start(async () => {
      setError(null)
      setSaved('')
      const r = await updateEventAction(event.name, patch).catch(() => ({ error: 'Couldn’t save. Try again.' }))
      if (r.error) return setError({ where, text: r.error })
      setSaved(where === 'details' ? 'Changes saved.' : '')
      setDirty(false)
      setConfirming(false)
      router.refresh()
    })

  const card = 'flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5'

  return (
    <section aria-label="Event settings" className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <form
        className={card}
        onChange={() => {
          setDirty(true)
          setSaved('')
        }}
        onSubmit={(ev) => {
          ev.preventDefault()
          const f = new FormData(ev.currentTarget)
          save({ date: String(f.get('date')), venue: String(f.get('venue')), details: String(f.get('details')) }, 'details')
        }}
      >
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-extrabold">Event details</h2>
          <p className="text-sm text-muted">Shown on the event card and the tickets page. The name and ticket numbers can’t change.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Date
            <input name="date" type="date" defaultValue={event.date} className={input} />
          </label>
          <label className={label}>
            Venue
            <input name="venue" defaultValue={event.venue} placeholder="Where it’s held" className={input} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Details
            <textarea name="details" rows={3} defaultValue={event.details} placeholder="Anything volunteers should know" className={`${input} h-auto resize-y py-2`} />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
          <span role="status" className="mr-auto text-sm font-semibold">
            {error?.where === 'details' ? <span className="text-bad-text">{error.text}</span> : <span className="text-ok-text">{saved}</span>}
          </span>
          <button disabled={pending || !dirty} className={primary}>
            {pending && dirty ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <div className={card}>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-extrabold">Status</h2>
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <span className={`size-2 rounded-full ${open ? 'bg-ok-text' : 'bg-muted'}`} aria-hidden="true" />
            {open ? 'Open for scanning' : 'Closed'}
          </p>
        </div>
        <p className="text-sm text-muted">
          {open
            ? 'Scanners accept this event’s tickets. Close it when the event is over: scanners will turn its tickets away and the lists become read-only.'
            : 'Scanners turn this event’s tickets away and the lists are read-only. Reopen it to scan or make changes again.'}
        </p>
        {error?.where === 'status' && <p role="alert" className="text-sm font-semibold text-bad-text">{error.text}</p>}
        {!open ? (
          <button type="button" disabled={pending} onClick={() => save({ status: 'open' }, 'status')} className={`${primary} w-full`}>
            {pending ? 'Reopening…' : 'Reopen event'}
          </button>
        ) : confirming ? (
          // Two steps in place of a browser pop-up, so closing mid-event takes a deliberate second tap.
          <div role="group" aria-label="Confirm closing" className="flex flex-col gap-2 rounded-xl bg-bad/10 p-3">
            <p className="text-sm font-semibold text-bad-text">Close {event.name}? Scanning stops on every phone.</p>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => save({ status: 'closed' }, 'status')} className="flex h-10 flex-1 items-center justify-center rounded-lg bg-bad px-3 text-[15px] font-bold text-on-flag disabled:opacity-60">
                {pending ? 'Closing…' : 'Yes, close it'}
              </button>
              <button type="button" disabled={pending} autoFocus onClick={() => setConfirming(false)} className={`${secondary} flex-1 justify-center`}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={`${secondary} w-full justify-center border-bad/40 text-bad-text hover:bg-bad/5`}>
            Close event
          </button>
        )}
      </div>
    </section>
  )
}
