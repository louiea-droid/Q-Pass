'use client'

import { useEffect } from 'react'

// Small helpers for a noisy, dim door: a sound per result and a screen that stays on.
// Every browser API here is optional; when one is missing or refused, scanning carries on silently.

let ctx: AudioContext | null = null

/** Browsers (iOS especially) only allow sound after a tap, so call this from the first pointerdown. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  } catch {}
}

function beep(at: number, freq: number, ms: number, type: OscillatorType) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const end = at + ms / 1000
  osc.type = type
  osc.frequency.value = freq
  // 10 ms fade in and out, so the tone doesn't click.
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(0.2, at + 0.01)
  gain.gain.setValueAtTime(0.2, end - 0.01)
  gain.gain.linearRampToValueAtTime(0, end)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(end)
}

/** Green: one short high beep. Red: two low buzzes. */
export function playTone(ok: boolean): void {
  try {
    unlockAudio()
    if (!ctx) return
    const t = ctx.currentTime
    if (ok) beep(t, 880, 120, 'sine')
    else {
      beep(t, 220, 150, 'square')
      beep(t + 0.23, 220, 150, 'square')
    }
  } catch {}
}

/** Keeps the screen on while `active`. The browser drops the lock when the tab is hidden, so take it again on return. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let gone = false
    const take = async () => {
      try {
        if (document.visibilityState !== 'visible') return
        const l = await navigator.wakeLock.request('screen')
        if (gone) l.release().catch(() => {})
        else lock = l
      } catch {}
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      gone = true
      document.removeEventListener('visibilitychange', take)
      lock?.release().catch(() => {})
    }
  }, [active])
}
