'use client'

import type { Html5Qrcode } from 'html5-qrcode'
import Link from 'next/link'
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import InstallButton from '../InstallButton'
import Select from '../Select'
import SignOutButton from '../SignOutButton'
import { headline } from '@/lib/display'
import { type QueuedScan, checkOffline, drain, enqueue, isNetworkError, readQueue } from '@/lib/offline'
import { normalizeTicket, parsePayload } from '@/lib/qr'
import type { ScanOutcome, Staff } from '@/lib/types'
import ThemeToggle from '../ThemeToggle'
import HelpButton from '../HelpButton'
import { TabBar } from '../admin/AdminNav'
import { playTone, unlockAudio, useWakeLock } from './door'

type Torch = ReturnType<ReturnType<Html5Qrcode['getRunningTrackCameraCapabilities']>['torchFeature']>

const EVENT_KEY = 'tac-scan-event'
const COOLDOWN_MS = 2000
const SAME_CODE_MS = 5000
const AUTO_NEXT_S = 5 // seconds a red result stays up before scanning continues by itself
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

/**
 * Sends one scan; gives up after SCAN_TIMEOUT_MS and treats it as offline.
 * ponytail: the server may still finish a scan the phone gave up on, so a late "already used" is lost and the queued
 * copy later logs a red repeat. Rare (it needs an 8 s answer); the upgrade is the server dropping a resend it already saw.
 */
async function postScan(q: Pick<QueuedScan, 'event' | 'value' | 'method' | 'by'>): Promise<ScanOutcome> {
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), SCAN_TIMEOUT_MS)
  try {
    const r = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: q.event, value: q.value, method: q.method, by: q.by }),
      signal: stop.signal,
      cache: 'no-store',
    })
    if (r.status === 401) {
      // Signed out (session expired): a full load of the sign-in page, as the old server-action redirect did.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.assign('/signin')
      throw new Error('Signed out')
    }
    const body = await r.json()
    if (!r.ok) throw new Error(body.error ?? `Error ${r.status}`)
    return body
  } finally {
    clearTimeout(timer)
  }
}

// Any answer counts as sent: a ticket that was already used is logged red by the server and shows in the Action log.
const sendQueued = async (q: QueuedScan) => void (await postScan(q))

// One sync at a time for the whole page, even if the scanner is left and opened again mid-sync.
let draining = false
// ...and across tabs: the queue in localStorage is shared, so two open scanner tabs would send each scan twice.
const oneTabAtATime = (fn: () => Promise<void>) =>
  navigator.locks ? navigator.locks.request('qpass-drain', { ifAvailable: true }, (lock) => lock && fn()) : fn()

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
  const [videoShape, setVideoShape] = useState<number | null>(null) // camera width ÷ height, once the video is playing
  const [autoNextIn, setAutoNextIn] = useState(AUTO_NEXT_S)
  useWakeLock(!!event)

  // A red result pauses the camera; after AUTO_NEXT_S it moves on by itself, as if "Next person" was tapped.
  // Not while a ticket number is being typed.
  useEffect(() => {
    if (!paused || typing) return
    const start = Date.now()
    const id = setInterval(() => {
      const left = AUTO_NEXT_S - Math.floor((Date.now() - start) / 1000)
      if (left > 0) return setAutoNextIn(left)
      clearInterval(id)
      resume(true)
    }, 250)
    return () => {
      clearInterval(id)
      setAutoNextIn(AUTO_NEXT_S)
    }
  }, [paused, typing])

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
        await oneTabAtATime(async () => setPending((await drain(s, sendQueued)).left))
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

  function resume(auto = false) {
    lock.current.paused = false
    // Tapped: the same ticket may be scanned again on purpose. Timed out: that ticket may still be in front of the
    // camera, so it is ignored for another SAME_CODE_MS instead of flashing the same warning every few seconds.
    if (auto) lock.current.lastAt = Date.now()
    else lock.current.last = ''
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

  async function run(queued: Omit<QueuedScan, 'id'>) {
    lock.current.busy = true
    setBusy(true)
    setError('')
    setSavedOffline(null)
    setTyping(false)
    try {
      const o = await postScan(queued)
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
    let video: HTMLVideoElement | null = null
    const fitVideo = () => {
      if (video?.videoWidth && video.videoHeight) setVideoShape(video.videoWidth / video.videoHeight)
    }
    // Loaded in the browser only: the library touches `window` on import.
    import('html5-qrcode')
      .then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
        if (stopped) return
        // QR codes only: by default it tries ~17 barcode types on every frame, which made slow phones lag.
        qr = new Html5Qrcode('reader', { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] })
        // Ask the camera for a picture the shape of the box, so the video fills it edge to edge.
        const box = document.getElementById('reader')
        const aspectRatio = box?.clientHeight ? box.clientWidth / box.clientHeight : undefined
        return qr.start(
          { facingMode: 'environment' },
          { fps: 10, aspectRatio, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.8, height: Math.min(w, h) * 0.8 }) },
          (text) => {
            const l = lock.current
            if (l.busy || l.paused || (text === l.last && Date.now() - l.lastAt < SAME_CODE_MS)) return
            l.last = text
            l.lastAt = Date.now()
            run({ event, method: 'QR', value: text, at: new Date().toISOString(), by: staff.name })
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
        // Shape the camera box like the video, so a landscape webcam in a tall box shows no black bars.
        // `resize` also fires when the phone is turned and the camera switches orientation.
        video = document.querySelector<HTMLVideoElement>('#reader video')
        video?.addEventListener('resize', fitVideo)
        fitVideo()
      })
      .catch(() => {
        if (!stopped) setCameraError('Camera is blocked or unavailable. Allow camera access for this site, or type ticket numbers below.')
      })
    return () => {
      stopped = true
      video?.removeEventListener('resize', fitVideo)
      setVideoShape(null)
      setTorch(null)
      setTorchOn(false)
      if (qr?.isScanning) qr.stop().then(() => qr?.clear()).catch(() => {})
    }
    // Restart the camera only when the event changes; `run` reads live state through refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])

  return (
    // While scanning the screen is exactly one viewport tall: the camera takes what's left, so nothing scrolls.
    // On computers the card fits under the admin header (about 4rem) and its 1.5rem margins: 7.5rem in all.
    <div
      onPointerDown={unlockAudio}
      className={`mx-auto flex w-full max-w-md flex-col lg:my-6 lg:rounded-3xl lg:border lg:border-line lg:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.35)] ${
        event ? 'h-dvh lg:h-[min(46rem,calc(100dvh-7.5rem))]' : 'min-h-dvh lg:min-h-[min(46rem,calc(100dvh-7.5rem))]'
      }`}
    >
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
          <HelpButton admin={staff.role === 'admin'} />
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
            <InstallButton className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left font-semibold hover:bg-soft" />
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

          {/* Fills the space left over; the camera is asked for a picture of this shape, so it fills the box.
              A camera that ignores that request gets the box reshaped to its video instead (no black bars). */}
          <div
            className={`relative mx-4 min-h-40 overflow-hidden rounded-3xl bg-[#141518] [container-type:size] lg:min-h-28 ${videoShape ? 'flex-initial' : 'flex-1'}`}
            style={videoShape ? { aspectRatio: videoShape } : undefined}
          >
            {/* The library's own shaded box is hidden; the frame below draws the same area in Q-Pass style.
                Keep the video at its own shape, centred: the library reads the scan area as if the video were
                never cropped, so object-cover or a forced height makes it miss codes in tall boxes. */}
            <div id="reader" className="flex size-full items-center justify-center [&_#qr-shaded-region]:hidden" />
            {/* Flashlight: Android Chrome exposes it; iPhones don't, so the button stays hidden there. */}
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
            {/* Same size as qrbox (80% of the shorter side), with the camera dimmed around it. */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 m-auto size-[80cqmin] rounded-[26px] shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)] transition-opacity duration-300 ${paused ? 'opacity-40' : ''}`}
            >
              <svg className="absolute inset-0 size-full text-accent" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                <path vectorEffect="non-scaling-stroke" d="M1 22V11A10 10 0 0 1 11 1h11M78 1h11a10 10 0 0 1 10 10v11M99 78v11a10 10 0 0 1-10 10H78M22 99H11A10 10 0 0 1 1 89V78" />
              </svg>
              {/* The wrapper is as tall as the line's travel (8% to 92%) and slides by its own height: a pure
                  transform, so the sweep runs on the GPU without a layout every frame. */}
              {!paused && (
                <span className="absolute inset-x-[10%] top-[8%] h-[84%] animate-scan">
                  <span className="block h-0.5 rounded-full bg-accent shadow-[0_0_12px_2px] shadow-accent/60" />
                </span>
              )}
            </div>
          </div>

          {cameraError && (
            <p role="alert" className="mx-4 mt-3 rounded-xl border border-bad p-3 text-sm text-bad-text">
              {cameraError}
            </p>
          )}

          {/* Fixed height, so a result never resizes the camera above it. Cards scroll inside if ever too long. */}
          <div aria-live="polite" className="mx-4 mt-3 mb-3 h-44 shrink-0 *:h-full *:overflow-y-auto">
            {!busy && !error && !outcome && savedOffline === null && (
              // Tells people where the result will appear, before the first scan and between scans.
              <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-strong px-4 text-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1 text-muted" aria-hidden="true">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
                </svg>
                <p className="text-base font-bold">The result shows here</p>
                <p className="text-sm text-muted">Point the camera at the QR code on a ticket.</p>
              </div>
            )}
            {busy && <p className="grid place-items-center rounded-2xl bg-surface text-lg font-semibold">Checking…</p>}
            {!busy && error && (
              <p role="alert" className="rounded-2xl bg-bad p-3 text-base font-semibold text-on-flag">
                {error}
              </p>
            )}
            {!busy && outcome && <Result outcome={outcome} />}
            {!busy && savedOffline !== null && (
              // Amber, not green: nobody has checked this ticket yet.
              <section className="flex flex-col gap-0.5 rounded-2xl bg-note p-3 text-note-ink">
                <span className="flex items-center gap-2 text-lg font-bold">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 20 0M5 12.9a10 10 0 0 1 14 0M3 3l18 18" />
                  </svg>
                  Saved offline
                </span>
                <span className="text-2xl leading-tight font-extrabold wrap-anywhere">
                  {savedOffline ? `Ticket ${savedOffline}` : 'This ticket'}
                </span>
                <span className="text-[15px] leading-snug">
                  Let them in. It syncs when you’re back online.
                </span>
              </section>
            )}
          </div>

          <div className="sticky bottom-0 mt-auto border-t border-line bg-surface p-4 lg:rounded-b-3xl">
            {typing ? (
              <ManualEntry
                disabled={busy}
                onCancel={() => setTyping(false)}
                onSubmit={(t) => {
                  resume()
                  run({ event, method: 'manual', value: t, at: new Date().toISOString(), by: staff.name })
                }}
              />
            ) : (
              <div className="flex gap-2.5">
                {paused ? (
                  <>
                    <KeypadButton iconOnly onClick={() => setTyping(true)} />
                    <button
                      onClick={() => resume()}
                      className="h-10 flex-1 rounded-xl bg-primary text-sm font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover"
                    >
                      Next person <span className="font-semibold tabular-nums opacity-70">· {autoNextIn}s</span>
                    </button>
                  </>
                ) : (
                  <KeypadButton onClick={() => setTyping(true)} />
                )}
              </div>
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
      className={`flex h-10 items-center justify-center gap-2 rounded-xl border border-primary bg-surface text-sm font-bold text-primary transition-colors duration-200 hover:bg-soft ${iconOnly ? 'w-10 shrink-0' : 'w-full'}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h8" />
      </svg>
      {!iconOnly && 'Type a ticket number'}
    </button>
  )
}

const REJECT_TITLE: Record<string, string> = {
  already_checked_in: 'Already scanned',
  wrong_event: 'Wrong event',
  event_closed: 'Event closed',
  not_found: 'Not valid',
}

function Result({ outcome }: { outcome: ScanOutcome }) {
  if (outcome.result === 'checked_in')
    return (
      <section className="flex flex-col gap-0.5 rounded-2xl bg-ok p-3 text-on-flag">
        <span className="flex items-center gap-2 text-lg font-bold">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="m8 12 3 3 5-6" />
          </svg>
          Checked in
        </span>
        <span className="text-2xl leading-tight font-extrabold wrap-anywhere">{headline(outcome)}</span>
        {outcome.name && <span className="text-[15px] text-[#d7f0e0]">Ticket {outcome.ticket}</span>}
        {outcome.group && <GroupLine group={outcome.group} />}
      </section>
    )

  const used = outcome.result === 'already_checked_in'
  const detail = used
    ? `${outcome.name ? `Ticket ${outcome.ticket} · ` : ''}Scanned ${fmtTime(outcome.checkedInAt)} by ${outcome.checkedInBy || 'someone'}`
    : outcome.message === 'This event is closed' // the title already says "Event closed"
      ? ''
      : outcome.message
  return (
    <section role="alert" className="flex flex-col gap-0.5 rounded-2xl bg-bad p-3 text-on-flag">
      <span className="flex items-center gap-2 text-lg font-bold">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 7v6M12 17h.01" />
        </svg>
        {REJECT_TITLE[outcome.result] ?? 'Not checked in'}
      </span>
      {outcome.ticket ? (
        <span className="text-2xl leading-tight font-extrabold wrap-anywhere">{headline(outcome)}</span>
      ) : null}
      {detail && <span className="text-[15px] leading-tight text-[#ffe1dd]">{detail}</span>}
      {outcome.group && <GroupLine group={outcome.group} />}
      <span className="mt-auto text-sm leading-snug font-semibold">
        Check ID or call an admin.
      </span>
    </section>
  )
}

/** "Group: 2 of 5 here": the rest of the family is still to come. */
function GroupLine({ group }: { group: { total: number; here: number } }) {
  return (
    <span className="mt-0.5 flex w-fit items-center gap-1.5 rounded-lg bg-white/15 px-2 py-0.5 text-[15px] font-semibold">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      Group: {group.here} of {group.total} here
    </span>
  )
}

function ManualEntry({ disabled, onSubmit, onCancel }: { disabled: boolean; onSubmit: (t: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  // One row, the same height as the button it replaces, so the camera doesn't shrink while typing.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value) onSubmit(value)
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      className="flex gap-2"
    >
      <label htmlFor="manual" className="sr-only">
        Ticket number
      </label>
      <input
        id="manual"
        autoFocus
        inputMode="numeric"
        autoComplete="off"
        placeholder="Ticket number"
        value={value}
        // Digits only, up to 9: "#57", "No. 57", a stray space or a pasted "Ticket 0057" still work.
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 9))}
        className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-base font-semibold tabular-nums placeholder:font-normal placeholder:text-muted"
      />
      <button disabled={disabled || !value} className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-ink hover:bg-primary-hover disabled:opacity-50">
        Check in
      </button>
      <button type="button" onClick={onCancel} aria-label="Back to camera" className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-soft">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </form>
  )
}
