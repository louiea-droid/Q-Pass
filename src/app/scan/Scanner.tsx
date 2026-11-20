'use client'

import type { Html5Qrcode } from 'html5-qrcode'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { manualScanAction, scanAction, setNameAction } from '../actions'
import type { ScanOutcome } from '@/lib/types'

const EVENT_KEY = 'tac-scan-event'
const COOLDOWN_MS = 2000
const SAME_CODE_MS = 5000

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

const readSaved = () => {
  try {
    return localStorage.getItem(EVENT_KEY) ?? ''
  } catch {
    return ''
  }
}
const noSubscribe = () => () => {}

export default function Scanner({ events }: { events: string[] }) {
  const [chosen, setChosen] = useState<string | null>(null)
  // The event chosen last time on this phone (empty on the server).
  const saved = useSyncExternalStore(noSubscribe, readSaved, () => '')
  const event = chosen ?? (events.includes(saved) ? saved : events.length === 1 ? events[0] : '')
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const lock = useRef({ busy: false, last: '', lastAt: 0 })

  function chooseEvent(name: string) {
    setChosen(name)
    setCameraError('')
    setOutcome(null)
    try {
      localStorage.setItem(EVENT_KEY, name)
    } catch {}
  }

  async function run(action: () => Promise<ScanOutcome>) {
    lock.current.busy = true
    setBusy(true)
    setError('')
    try {
      const o = await action()
      setOutcome(o)
      navigator.vibrate?.(o.result === 'checked_in' ? 80 : [60, 60, 60])
    } catch {
      setOutcome(null)
      setError('Couldn’t save that scan. Check the internet connection and scan again.')
      navigator.vibrate?.([60, 60, 60])
    } finally {
      setBusy(false)
      setTimeout(() => (lock.current.busy = false), COOLDOWN_MS)
    }
  }

  // Camera: runs while an event is selected.
  useEffect(() => {
    if (!event) return
    let qr: Html5Qrcode | undefined
    let stopped = false
    // Loaded in the browser only: the library touches `window` on import.
    import('html5-qrcode')
      .then(({ Html5Qrcode }) => {
        if (stopped) return
        qr = new Html5Qrcode('reader', { verbose: false })
        return qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.7, height: Math.min(w, h) * 0.7 }) },
          (text) => {
            const l = lock.current
            if (l.busy || (text === l.last && Date.now() - l.lastAt < SAME_CODE_MS)) return
            l.last = text
            l.lastAt = Date.now()
            run(() => scanAction(event, text))
          },
          undefined,
        )
      })
      .then(() => {
        // Event changed or page left while the camera was still starting.
        if (stopped && qr?.isScanning) qr.stop().catch(() => {})
      })
      .catch(() => {
        if (!stopped)
          setCameraError('Camera is blocked or unavailable. Allow camera access for this site, or type ticket numbers below.')
      })
    return () => {
      stopped = true
      if (qr?.isScanning) qr.stop().then(() => qr?.clear()).catch(() => {})
    }
  }, [event])

  if (events.length === 0)
    return (
      <section className="mx-auto max-w-md">
        <h1 className="font-serif text-2xl font-semibold">No open events</h1>
        <p className="mt-2 text-muted">Ask an admin to create or reopen an event, then reload this page.</p>
      </section>
    )

  return (
    <section className="mx-auto max-w-md">
      <div className="flex items-center gap-3">
        <label htmlFor="event" className="shrink-0 font-semibold">
          Event
        </label>
        <select
          id="event"
          value={event}
          onChange={(e) => chooseEvent(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2"
        >
          <option value="" disabled>
            Choose the event you’re scanning for
          </option>
          {events.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>

      {event && (
        <>
          <div id="reader" className="mt-4 aspect-square w-full overflow-hidden rounded-xl bg-black" />
          {cameraError && (
            <p role="alert" className="mt-3 rounded-md border border-bad p-3 text-sm text-bad">
              {cameraError}
            </p>
          )}

          <div aria-live="polite" className="mt-4">
            {busy && <p className="rounded-xl bg-surface p-5 text-lg">Checking…</p>}
            {!busy && error && (
              <p role="alert" className="rounded-xl bg-bad p-5 text-lg font-semibold text-on-flag">
                {error}
              </p>
            )}
            {!busy && outcome && <Result outcome={outcome} event={event} />}
            {!busy && !outcome && !error && <p className="text-muted">Point the camera at a ticket’s QR code.</p>}
          </div>

          <ManualEntry disabled={busy} onSubmit={(t) => run(() => manualScanAction(event, t))} />
        </>
      )}
    </section>
  )
}

function Result({ outcome, event }: { outcome: ScanOutcome; event: string }) {
  const ok = outcome.result === 'checked_in'
  return (
    <div className={`rounded-xl p-5 text-on-flag ${ok ? 'bg-ok' : 'bg-bad'}`}>
      <p className="text-sm font-semibold opacity-90">{ok ? 'Checked in' : 'Not checked in'}</p>
      {outcome.ticket && <p className="font-serif text-5xl font-bold tabular-nums">{outcome.ticket}</p>}
      <p className="mt-1 text-2xl font-semibold [overflow-wrap:anywhere]">
        {outcome.result === 'already_checked_in' ? outcome.name || 'No name' : outcome.message}
      </p>
      {outcome.result === 'already_checked_in' && (
        <p className="mt-1">
          Already checked in at {fmtTime(outcome.checkedInAt)} by {outcome.checkedInBy || 'unknown'}
        </p>
      )}
      {ok && !outcome.name && outcome.ticket && <AddName event={event} ticket={outcome.ticket} />}
    </div>
  )
}

function AddName({ event, ticket }: { event: string; ticket: string }) {
  const [name, setName] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  if (state === 'saved') return <p className="mt-3 font-semibold">Saved {name} to ticket {ticket}.</p>
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setState('saving')
        try {
          await setNameAction(event, ticket, name)
          setState('saved')
        } catch {
          setState('error')
        }
      }}
    >
      <label htmlFor="add-name" className="sr-only">
        Name for ticket {ticket} (optional)
      </label>
      <input
        id="add-name"
        name="name"
        autoComplete="off"
        placeholder="Add a name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-w-0 flex-1 rounded-md bg-surface px-3 py-2 text-ink"
      />
      <button disabled={state === 'saving'} className="rounded-md bg-surface px-4 py-2 font-semibold text-ink disabled:opacity-60">
        {state === 'saving' ? 'Saving…' : 'Save name'}
      </button>
      {state === 'error' && <span role="alert" className="basis-full text-sm font-semibold">Couldn’t save the name. Try again.</span>}
    </form>
  )
}

function ManualEntry({ disabled, onSubmit }: { disabled: boolean; onSubmit: (ticket: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <form
      className="mt-6 border-t border-line pt-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        onSubmit(value)
        setValue('')
      }}
    >
      <label htmlFor="manual" className="font-semibold">
        QR won’t scan? Type the ticket number
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="manual"
          name="ticket"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{1,4}"
          placeholder="0057"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-lg tabular-nums"
        />
        <button disabled={disabled} className="rounded-md bg-pine px-5 py-2 font-semibold text-pine-ink disabled:opacity-60">
          Check in
        </button>
      </div>
    </form>
  )
}
