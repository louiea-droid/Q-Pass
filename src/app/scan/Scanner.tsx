'use client'

import type { Html5Qrcode } from 'html5-qrcode'
import Link from 'next/link'
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { manualScanAction, scanAction, setNameAction } from '../actions'
import Select from '../Select'
import SignOutButton from '../SignOutButton'
import { headline } from '@/lib/display'
import { type QueuedScan, checkOffline, drain, enqueue, isNetworkError, readQueue, withTimeout } from '@/lib/offline'
import { normalizeTicket, parsePayload } from '@/lib/qr'
import type { ScanOutcome, Staff } from '@/lib/types'
import ThemeToggle from '../ThemeToggle'
import { TabBar } from '../admin/AdminNav'
import { playTone, unlockAudio, useWakeLock } from './door'

type Torch = ReturnType<ReturnType<Html5Qrcode['getRunningTrackCameraCapabilities']>['torchFeature']>

const EVENT_KEY = 'tac-scan-event'
const COOLDOWN_MS = 2000
const SAME_CODE_MS = 5000
const COUNT_POLL_MS = 15_000

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

const readSaved = () => {
  try {
    return localStorage.getItem(EVENT_KEY) ?? ''
  } catch {
    return ''
  }
}
const noSubscribe = () => () => {}

// Local storage can be blocked (private mode); offline saving is then off and the old error shows instead.
const storage = () => {
  try {
    return localStorage
  } catch {
    return null
  }
}

// A scan with no answer by then is treated as offline: on weak Wi-Fi requests hang instead of failing.
const SCAN_TIMEOUT_MS = 8000

const sendQueued = async (q: QueuedScan) => {
  // Any answer counts as sent: a ticket that was already used is logged red by the server and shows in the Action log.
  if (q.method === 'QR') await withTimeout(scanAction(q.event, q.value, q.by), SCAN_TIMEOUT_MS)
  else await withTimeout(manualScanAction(q.event, q.value, q.by), SCAN_TIMEOUT_MS)
}

// One sync at a time for the whole page, even if the scanner is left and opened again mid-sync.
let draining = false

const OFFLINE_REJECT = {
  not_ticket: 'This isn’t a Q-Pass ticket for this event.',
  wrong_event: 'This ticket is for another event.',
  duplicate: 'This ticket was already scanned on this phone while offline.',
} as const

const SYNC_MS = 15_000

export default function Scanner({ events, staff, share }: { events: string[]; staff: Staff; share?: ReactNode }) {
  const [chosen, setChosen] = useState<string | null>(null)
  // The event chosen last time on this phone (empty on the server).
  const saved = useSyncExternalStore(noSubscribe, readSaved, () => '')
  const event = chosen ?? (events.includes(saved) ? saved : events.length === 1 ? events[0] : '')
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [paused, setPaused] = useState(false)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [typing, setTyping] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const lock = useRef({ busy: false, paused: false, last: '', lastAt: 0 })
  const [torch, setTorch] = useState<Torch | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [savedOffline, setSavedOffline] = useState<string | null>(null) // ticket label of the last scan saved offline
  const [pending, setPending] = useState(0)
  useWakeLock(!!event)

  // Send scans saved offline: on load, when the phone comes back online, and every 15 s while any are waiting.
  // ponytail: offline scans get the sync time, not the scan time (check_in uses now()), so the arrivals chart
  // shifts by the outage length. Upgrade path: a p_at parameter on check_in.
  useEffect(() => {
    const sync = async () => {
      const s = storage()
      if (!s) return
      setPending(readQueue(s).length) // show the badge at once, even if the first send is slow
      if (draining) return
      draining = true
      try {
        setPending((await drain(s, sendQueued)).left)
      } finally {
        draining = false
      }
    }
    sync()
    const id = setInterval(() => {
      if (readQueue(storage() ?? { getItem: () => null }).length) sync()
    }, SYNC_MS)
    window.addEventListener('online', sync)
    return () => {
      clearInterval(id)
      window.removeEventListener('online', sync)
    }
  }, [])

  async function toggleTorch() {
    if (!torch) return
    try {
      await torch.apply(!torchOn)
      setTorchOn(!torchOn)
    } catch {}
  }

  function chooseEvent(name: string) {
    setChosen(name)
    setCameraError('')
    setOutcome(null)
    setCount(null)
    resume()
    try {
      localStorage.setItem(EVENT_KEY, name)
    } catch {}
  }

  function resume() {
    lock.current.paused = false
    lock.current.last = '' // the same ticket may be scanned again on purpose
    setPaused(false)
    setOutcome(null)
    setSavedOffline(null)
    setError('')
  }

  async function refreshCount() {
    if (!event) return
    try {
      const r = await fetch(`/api/count?event=${encodeURIComponent(event)}`, { cache: 'no-store' })
      if (r.ok) setCount((await r.json()).checkedIn)
    } catch {}
  }

  async function run(action: () => Promise<ScanOutcome>, queued: Omit<QueuedScan, 'id'>) {
    lock.current.busy = true
    setBusy(true)
    setError('')
    setSavedOffline(null)
    setTyping(false)
    try {
      const o = await withTimeout(action(), SCAN_TIMEOUT_MS)
      setOutcome(o)
      const ok = o.result === 'checked_in'
      navigator.vibrate?.(ok ? 80 : [60, 60, 60])
      playTone(ok)
      // A warning stops the line: the volunteer must tap "Next person" before the camera scans again.
      if (!ok) {
        lock.current.paused = true
        setPaused(true)
      } else refreshCount()
    } catch (e) {
      setOutcome(null)
      const s = storage()
      if (s && isNetworkError(e, navigator.onLine)) {
        // No internet. What the phone can rule out on its own stops the line, like any red result.
        const verdict = checkOffline(readQueue(s), queued)
        if (verdict !== 'ok') {
          setError(`${OFFLINE_REJECT[verdict]} (No internet right now.)`)
          navigator.vibrate?.([60, 60, 60])
          playTone(false)
          lock.current.paused = true
          setPaused(true)
          return
        }
        // Otherwise keep the scan on this phone and let the person in; it is checked when the connection is back.
        const q = enqueue(s, queued)
        if (!q) {
          setError('No internet, and this phone’s storage is full, so the scan wasn’t saved. Type the ticket number down and check it in later.')
          navigator.vibrate?.([60, 60, 60])
          playTone(false)
          lock.current.paused = true
          setPaused(true)
          return
        }
        setPending(q.length)
        setSavedOffline((queued.method === 'QR' ? parsePayload(queued.value)?.ticket : normalizeTicket(queued.value)) ?? '')
        navigator.vibrate?.(80)
        playTone(true)
        return
      }
      setError('Couldn’t save that scan. Check the internet connection and scan again.')
      navigator.vibrate?.([60, 60, 60])
      playTone(false)
    } finally {
      setBusy(false)
      setTimeout(() => (lock.current.busy = false), COOLDOWN_MS)
    }
  }

  // Live count of people checked in, for everyone at the door.
  useEffect(() => {
    if (!event) return
    let stop = false
    const tick = async () => {
      try {
        const r = await fetch(`/api/count?event=${encodeURIComponent(event)}`, { cache: 'no-store' })
        if (r.ok && !stop) setCount((await r.json()).checkedIn)
      } catch {}
    }
    tick()
    const id = setInterval(tick, COUNT_POLL_MS)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [event])

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
            if (l.busy || l.paused || (text === l.last && Date.now() - l.lastAt < SAME_CODE_MS)) return
            l.last = text
            l.lastAt = Date.now()
            run(() => scanAction(event, text), { event, method: 'QR', value: text, at: new Date().toISOString(), by: staff.name })
          },
          undefined,
        )
      })
      .then(() => {
        // Event changed or page left while the camera was still starting.
        if (stopped) {
          if (qr?.isScanning) qr.stop().catch(() => {})
          return
        }
        // Flashlight: Android Chrome exposes it; iPhones don't, so the button stays hidden there.
        try {
          const t = qr?.getRunningTrackCameraCapabilities().torchFeature()
          if (t?.isSupported()) setTorch(t)
        } catch {}
      })
      .catch(() => {
        if (!stopped) setCameraError('Camera is blocked or unavailable. Allow camera access for this site, or type ticket numbers below.')
      })
    return () => {
      stopped = true
      setTorch(null)
      setTorchOn(false)
      if (qr?.isScanning) qr.stop().then(() => qr?.clear()).catch(() => {})
    }
    // Restart the camera only when the event changes; `run` reads live state through refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])

  return (
    <div onPointerDown={unlockAudio} className="mx-auto flex min-h-dvh w-full max-w-md flex-col lg:my-8 lg:min-h-[min(46rem,calc(100dvh-9rem))] lg:rounded-3xl lg:border lg:border-line lg:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.35)]">
      <header className="flex items-center gap-2.5 border-b border-line bg-surface px-4 pt-4 pb-3 lg:rounded-t-3xl">
        <Select
          label="Event"
          value={event}
          onChange={(e) => chooseEvent(e.target.value)}
          className="flex-1"
          icon={<span className="size-2 rounded-full bg-gold" />}
        >
          <option value="" disabled>
            {events.length ? 'Choose the event' : 'No open events'}
          </option>
          {events.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        {share}
        {/* On computers an admin has these in the admin header above. */}
        <span className={`contents ${staff.role === 'admin' ? 'lg:hidden' : ''}`}>
          <ThemeToggle />
        </span>
        <details className={`relative ${staff.role === 'admin' ? 'lg:hidden' : ''}`}>
          <summary
            aria-label={`Signed in as ${staff.name}. Open menu`}
            className="flex size-11 list-none items-center justify-center rounded-full bg-primary text-base font-bold text-primary-ink [&::-webkit-details-marker]:hidden"
          >
            {staff.name.trim().charAt(0).toUpperCase() || '?'}
          </summary>
          <div className="absolute right-0 z-20 mt-2 flex w-60 flex-col gap-1 rounded-2xl border border-line bg-surface p-2 shadow-lg">
            <p className="px-3 py-2 text-sm text-muted">
              Signed in as <strong className="text-ink">{staff.name}</strong>
            </p>
            {staff.role === 'admin' && (
              <Link href="/admin" className="rounded-xl px-3 py-3 font-semibold hover:bg-soft">
                Check-in desk
              </Link>
            )}
            <SignOutButton className="w-full rounded-xl px-3 py-3 text-left font-semibold hover:bg-soft" />
          </div>
        </details>
      </header>

      {!event ? (
        <section className="flex flex-1 flex-col gap-3 px-6 pt-10">
          <h1 className="text-2xl font-extrabold">{events.length ? 'Which event are you scanning for?' : 'No open events'}</h1>
          <p className="text-muted">
            {events.length
              ? 'Pick it from the list at the top. This phone remembers it next time.'
              : 'Ask an admin to create or reopen an event, then reload this page.'}
          </p>
        </section>
      ) : (
        <>
          <div className="flex items-baseline justify-between px-5 pt-3.5 pb-2.5 text-sm text-muted">
            <span className="font-semibold">Scanning as {staff.name}</span>
            <span aria-live="polite">
              <strong className="text-lg text-ink tabular-nums">{count ?? '…'}</strong> checked in
            </span>
          </div>
          {pending > 0 && (
            <p role="status" className="mx-4 mb-2.5 flex items-center gap-2 rounded-xl bg-note px-3 py-2 text-sm font-semibold text-note-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 20 0M5 12.9a10 10 0 0 1 14 0M3 3l18 18" />
              </svg>
              {pending === 1 ? '1 scan' : `${pending} scans`} waiting to send. Keep scanning.
            </p>
          )}

          <div className={`relative mx-4 overflow-hidden rounded-3xl bg-[#141518] [container-type:size] ${outcome || error || savedOffline !== null ? 'h-64 lg:h-56' : 'h-96 lg:h-80'} transition-[height] duration-300`}>
            {/* The library's own shaded box is hidden; the frame below draws the same area in Q-Pass style. */}
            <div id="reader" className="size-full [&_#qr-shaded-region]:hidden [&_video]:size-full [&_video]:object-cover" />
            {torch && (
              <button
                type="button"
                onClick={toggleTorch}
                aria-pressed={torchOn}
                aria-label="Flashlight"
                className={`absolute top-3 right-3 z-10 grid size-11 place-items-center rounded-full transition-colors duration-200 ${
                  torchOn ? 'bg-accent text-accent-ink' : 'bg-black/45 text-white hover:bg-black/60'
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12z" />
                  <path d="M6 6h12M12 12v2" />
                </svg>
              </button>
            )}
            {/* Same size as qrbox (70% of the shorter side), with the camera dimmed around it. */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 m-auto size-[70cqmin] rounded-[26px] shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)] transition-opacity duration-300 ${paused ? 'opacity-40' : ''}`}
            >
              <svg className="absolute inset-0 size-full text-accent" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                <path vectorEffect="non-scaling-stroke" d="M1 22V11A10 10 0 0 1 11 1h11M78 1h11a10 10 0 0 1 10 10v11M99 78v11a10 10 0 0 1-10 10H78M22 99H11A10 10 0 0 1 1 89V78" />
              </svg>
              {!paused && <span className="absolute inset-x-[10%] top-1/2 h-0.5 animate-scan rounded-full bg-accent shadow-[0_0_12px_2px] shadow-accent/60" />}
            </div>
            <p className="absolute inset-x-0 bottom-3 flex justify-center">
              <span className="rounded-full bg-black/55 px-3 py-1 text-sm font-medium text-white">
                {paused ? 'Paused. Tap “Next person” to scan again' : 'Hold the QR code inside the frame'}
              </span>
            </p>
          </div>

          {cameraError && (
            <p role="alert" className="mx-4 mt-3 rounded-xl border border-bad p-3 text-sm text-bad-text">
              {cameraError}
            </p>
          )}

          <div aria-live="polite" className="mx-4 mt-4">
            {busy && <p className="rounded-3xl bg-surface p-6 text-lg font-semibold">Checking…</p>}
            {!busy && error && (
              <p role="alert" className="rounded-3xl bg-bad p-6 text-lg font-semibold text-on-flag">
                {error}
              </p>
            )}
            {!busy && outcome && <Result outcome={outcome} event={event} />}
            {!busy && savedOffline !== null && (
              // Amber, not green: nobody has checked this ticket yet. Same size as the green and red cards.
              <section className="flex min-h-73 flex-col gap-2 rounded-3xl bg-note p-5.5 text-note-ink">
                <span className="flex items-center gap-2.5 text-lg font-bold">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 20 0M5 12.9a10 10 0 0 1 14 0M3 3l18 18" />
                  </svg>
                  Saved offline
                </span>
                <span className="text-2xl leading-tight font-extrabold wrap-anywhere">
                  {/^\d{4}$/.test(savedOffline) ? `Ticket ${savedOffline}` : 'This ticket'}
                </span>
                <span className="text-base leading-relaxed">
                  It will be checked when the internet is back. Let them in.
                </span>
                <span className="mt-auto border-t border-current/25 pt-3 text-[15px] leading-relaxed">Ready for the next person.</span>
              </section>
            )}
          </div>

          <div className="flex-1" />

          <div className="sticky bottom-0 border-t border-line bg-surface p-4 lg:rounded-b-3xl">
            {typing ? (
              <ManualEntry
                disabled={busy}
                onCancel={() => setTyping(false)}
                onSubmit={(t) => {
                  resume()
                  run(() => manualScanAction(event, t), { event, method: 'manual', value: t, at: new Date().toISOString(), by: staff.name })
                }}
              />
            ) : paused ? (
              <div className="flex gap-2.5">
                <KeypadButton iconOnly onClick={() => setTyping(true)} />
                <button
                  onClick={resume}
                  className="h-14 flex-1 rounded-2xl bg-primary text-[17px] font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover"
                >
                  Next person
                </button>
              </div>
            ) : (
              <KeypadButton onClick={() => setTyping(true)} />
            )}
            {staff.role === 'admin' && <TabBar className="mt-3 bg-surface lg:hidden" />}
          </div>
        </>
      )}
      {/* Admins can always get back to the desk; volunteers only ever see the scanner. */}
      {staff.role === 'admin' && !event && (
        <div className="sticky bottom-0 mt-auto p-4 lg:hidden">
          <TabBar />
        </div>
      )}
    </div>
  )
}

function KeypadButton({ onClick, iconOnly = false }: { onClick: () => void; iconOnly?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={iconOnly ? 'Type a ticket number' : undefined}
      className={`flex h-14 items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-primary bg-surface text-[17px] font-bold text-primary transition-colors duration-200 hover:bg-soft ${iconOnly ? 'w-14 shrink-0' : 'w-full'}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h8" />
      </svg>
      {!iconOnly && 'Type a ticket number'}
    </button>
  )
}

const REJECT_TITLE: Record<string, string> = {
  already_checked_in: 'Already used. Don’t let in yet',
  wrong_event: 'Ticket for a different event',
  event_closed: 'This event is closed',
  not_found: 'Not a valid ticket',
}

function Result({ outcome, event }: { outcome: ScanOutcome; event: string }) {
  if (outcome.result === 'checked_in')
    return (
      <section className="flex min-h-73 flex-col gap-2 rounded-3xl bg-ok p-5.5 text-on-flag">
        <span className="flex items-center gap-2.5 text-lg font-bold">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="m8 12 3 3 5-6" />
          </svg>
          Welcome! Checked in
        </span>
        <span className="text-2xl leading-tight font-extrabold wrap-anywhere">{headline(outcome)}</span>
        {outcome.name && <span className="text-base text-[#d7f0e0]">Ticket {outcome.ticket}</span>}
        {outcome.group && <GroupLine group={outcome.group} />}
        {!outcome.name && outcome.ticket && <AddName event={event} ticket={outcome.ticket} />}
        {/* Same ending as the red card, so both results are the same size. */}
        <span className="mt-auto border-t border-white/25 pt-3 text-[15px] leading-relaxed">Ready for the next person.</span>
      </section>
    )

  const used = outcome.result === 'already_checked_in'
  return (
    <section role="alert" className="flex min-h-73 flex-col gap-2 rounded-3xl bg-bad p-5.5 text-on-flag">
      <span className="flex items-center gap-2.5 text-lg font-bold">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 7v6M12 17h.01" />
        </svg>
        {REJECT_TITLE[outcome.result] ?? 'Not checked in'}
      </span>
      {outcome.ticket ? (
        <span className="text-2xl leading-tight font-extrabold wrap-anywhere">{headline(outcome)}</span>
      ) : null}
      <span className="text-base leading-relaxed text-[#ffe1dd]">
        {used
          ? `${outcome.name ? `Ticket ${outcome.ticket} was` : 'It was'} checked in at ${fmtTime(outcome.checkedInAt)} by ${outcome.checkedInBy || 'someone'}.`
          : outcome.message}
      </span>
      {outcome.group && <GroupLine group={outcome.group} />}
      <span className="mt-auto border-t border-white/25 pt-3 text-[15px] leading-relaxed">
        Ask for an ID, or call an admin if this looks wrong.
      </span>
    </section>
  )
}

/** "2 of 5 in this group are here": the rest of the family is still to come. */
function GroupLine({ group }: { group: { total: number; here: number } }) {
  return (
    <span className="mt-1 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-base font-semibold">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      {group.here} of {group.total} in this group are here
    </span>
  )
}

function AddName({ event, ticket }: { event: string; ticket: string }) {
  const [name, setName] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  if (state === 'saved') return <p className="mt-2 font-semibold">Saved {name} to ticket {ticket}.</p>
  return (
    <form
      className="mt-2 flex flex-wrap gap-2"
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
        autoComplete="off"
        placeholder="Add a name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-12 min-w-0 flex-1 rounded-xl bg-surface px-3 text-base text-ink"
      />
      <button disabled={state === 'saving'} className="h-12 rounded-xl bg-surface px-4 font-bold text-ink disabled:opacity-60">
        {state === 'saving' ? 'Saving…' : 'Save'}
      </button>
      {state === 'error' && (
        <span role="alert" className="basis-full text-sm font-semibold">
          Couldn’t save the name. Try again.
        </span>
      )}
    </form>
  )
}

function ManualEntry({ disabled, onSubmit, onCancel }: { disabled: boolean; onSubmit: (t: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onSubmit(value)
      }}
      className="flex flex-col gap-2"
    >
      <label htmlFor="manual" className="font-bold">
        Ticket number
      </label>
      <div className="flex gap-2">
        <input
          id="manual"
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{1,4}"
          placeholder="0057"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-14 min-w-0 flex-1 rounded-xl border-[1.5px] border-line-strong bg-surface px-4 text-xl font-semibold tabular-nums"
        />
        <button disabled={disabled} className="h-14 rounded-2xl bg-primary px-5 font-bold text-primary-ink hover:bg-primary-hover disabled:opacity-60">
          Check in
        </button>
      </div>
      <button type="button" onClick={onCancel} className="h-11 rounded-xl font-semibold text-muted hover:bg-soft">
        Back to camera
      </button>
    </form>
  )
}
