'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, useTransition } from 'react'
import { createEventAction, deleteEventAction, updateEventAction } from '../../actions'
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

/**
 * Header controls on an event's page: "Edit" opens a dialog for date, venue and details;
 * the ⋯ menu holds Close / Reopen, with a second tap to confirm closing.
 */
export function EditEvent({ event, tickets = 0, checkedIn = 0 }: { event: EventInfo; tickets?: number; checkedIn?: number }) {
  const router = useRouter()
  const id = useId()
  const dialogId = `${id}-edit`
  const menuId = `${id}-menu`
  const deleteId = `${id}-delete`
  const [typed, setTyped] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const remove = () =>
    start(async () => {
      setDeleteError('')
      const r = await deleteEventAction(event.name, typed).catch(() => ({ error: 'Couldn’t delete. Try again.' }))
      if (r.error) return setDeleteError(r.error)
      router.push('/admin/events')
      router.refresh()
    })
  const moreRef = useRef<HTMLButtonElement>(null)
  const [error, setError] = useState<{ where: 'details' | 'status'; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [opened, setOpened] = useState(0) // remounts the form on each open, so it starts from the saved values
  const [pending, start] = useTransition()
  const open = event.status === 'open'

  const save = (patch: Partial<Omit<EventInfo, 'name'>>, where: 'details' | 'status') =>
    start(async () => {
      setError(null)
      const r = await updateEventAction(event.name, patch).catch(() => ({ error: 'Couldn’t save. Try again.' }))
      if (r.error) return setError({ where, text: r.error })
      document.getElementById(where === 'details' ? dialogId : menuId)?.hidePopover()
      router.refresh()
    })

  // Popovers sit in the top layer; place the menu under its ⋯ button, right-aligned, kept on screen.
  const placeMenu = (menu: HTMLElement) => {
    const r = moreRef.current?.getBoundingClientRect()
    if (!r) return
    menu.style.top = `${r.bottom + 8}px`
    menu.style.left = `${Math.max(8, Math.min(r.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8))}px`
  }

  const iconBtn =
    'flex size-10 items-center justify-center rounded-lg border border-line-strong text-ink transition-colors duration-200 hover:bg-soft'

  return (
    <>
      <button type="button" popoverTarget={dialogId} className={`${secondary} gap-2`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Edit
      </button>
      <button ref={moreRef} type="button" popoverTarget={menuId} aria-label="More actions" className={iconBtn}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {/* ⋯ menu */}
      <div
        id={menuId}
        popover="auto"
        role="menu"
        aria-label="Event actions"
        onToggle={(e) => {
          if (e.newState === 'open') placeMenu(e.currentTarget)
          else setConfirming(false)
          setError(null)
        }}
        className="inset-auto m-0 w-64 rounded-xl border border-line-strong bg-surface p-1.5 text-ink shadow-[0_18px_40px_-16px_rgb(0_0_0/0.55)]"
      >
        {!open ? (
          <button type="button" role="menuitem" disabled={pending} onClick={() => save({ status: 'open' }, 'status')} className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-soft">
            <span className="text-[15px] font-semibold">{pending ? 'Reopening…' : 'Reopen event'}</span>
            <span className="text-xs text-muted">Scanning and changes work again.</span>
          </button>
        ) : confirming ? (
          <div role="group" aria-label="Confirm closing" className="flex flex-col gap-2 rounded-lg bg-bad/10 p-3">
            <p className="text-sm font-semibold text-bad-text">Close {event.name}? Scanning stops on every phone.</p>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => save({ status: 'closed' }, 'status')} className="flex h-9 flex-1 items-center justify-center rounded-lg bg-bad text-sm font-bold text-on-flag disabled:opacity-60">
                {pending ? 'Closing…' : 'Yes, close it'}
              </button>
              <button type="button" disabled={pending} autoFocus onClick={() => setConfirming(false)} className="flex h-9 flex-1 items-center justify-center rounded-lg border border-line-strong text-sm font-semibold hover:bg-soft">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" role="menuitem" onClick={() => setConfirming(true)} className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-soft">
            <span className="text-[15px] font-semibold text-bad-text">Close event…</span>
            <span className="text-xs text-muted">When it’s over. Scanners turn its tickets away.</span>
          </button>
        )}
        {error?.where === 'status' && <p role="alert" className="px-3 py-2 text-sm font-semibold text-bad-text">{error.text}</p>}
        <div className="my-1 border-t border-line" />
        <button type="button" role="menuitem" popoverTarget={deleteId} className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-soft">
          <span className="text-[15px] font-semibold text-bad-text">Delete event…</span>
          <span className="text-xs text-muted">Removes it with all tickets and check-ins.</span>
        </button>
      </div>

      {/* Delete dialog: the Delete button only works once the exact event name is typed. */}
      <div
        id={deleteId}
        popover="auto"
        role="alertdialog"
        aria-labelledby={`${deleteId}-title`}
        aria-describedby={`${deleteId}-desc`}
        onToggle={(e) => {
          if (e.newState !== 'open') return
          setTyped('')
          setDeleteError('')
        }}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/60"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (typed === event.name) remove()
          }}
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bad/15 text-bad-text" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
              </svg>
            </span>
            <div className="flex flex-col gap-1">
              <h2 id={`${deleteId}-title`} className="text-lg font-extrabold">
                Delete this event?
              </h2>
              <p id={`${deleteId}-desc`} className="text-sm text-muted">
                This permanently removes <strong className="text-ink">{event.name}</strong> with its{' '}
                {tickets.toLocaleString('en')} tickets, {checkedIn.toLocaleString('en')} check-ins and the scan log. It can’t be undone,
                and printed QR codes for it stop working.
              </p>
            </div>
          </div>
          <a
            href={`/api/export?event=${encodeURIComponent(event.name)}`}
            className="flex w-fit items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4 hover:no-underline"
          >
            Download the ticket list first
          </a>
          <label className={label}>
            <span>
              Type <span className="rounded bg-soft px-1.5 py-0.5 font-mono text-[13px]">{event.name}</span> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={typed !== '' && typed !== event.name}
              className={input}
            />
          </label>
          {deleteError && <p role="alert" className="text-sm font-semibold text-bad-text">{deleteError}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button type="button" popoverTarget={deleteId} popoverTargetAction="hide" className={secondary}>
              Cancel
            </button>
            <button
              disabled={pending || typed !== event.name}
              className="flex h-10 items-center rounded-lg bg-bad px-4 text-[15px] font-bold text-on-flag transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {pending ? 'Deleting…' : 'Delete event'}
            </button>
          </div>
        </form>
      </div>

      {/* Edit dialog */}
      <div
        id={dialogId}
        popover="auto"
        role="dialog"
        aria-labelledby={`${dialogId}-title`}
        onToggle={(e) => {
          if (e.newState !== 'open') return
          setOpened((n) => n + 1)
          setDirty(false)
          setError(null)
        }}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id={`${dialogId}-title`} className="text-lg font-extrabold">
              Edit event details
            </h2>
            <p className="text-sm text-muted">The name and ticket numbers can’t change.</p>
          </div>
          <button
            type="button"
            popoverTarget={dialogId}
            popoverTargetAction="hide"
            aria-label="Close"
            className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-soft hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form
          key={opened}
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onChange={() => setDirty(true)}
          onSubmit={(ev) => {
            ev.preventDefault()
            const f = new FormData(ev.currentTarget)
            save({ date: String(f.get('date')), venue: String(f.get('venue')), details: String(f.get('details')) }, 'details')
          }}
        >
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
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
            {error?.where === 'details' && <p role="alert" className="mr-auto text-sm font-semibold text-bad-text">{error.text}</p>}
            <button type="button" popoverTarget={dialogId} popoverTargetAction="hide" className={secondary}>
              Cancel
            </button>
            <button disabled={pending || !dirty} className={primary}>
              {pending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
