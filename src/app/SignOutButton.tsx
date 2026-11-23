'use client'

import { useId, useState } from 'react'
import { readQueue } from '@/lib/offline'
import { signOutAction } from './signin/actions'

/** "Sign out" that asks first, so a misclick at a busy door doesn't end the session. Warns about unsent offline scans. */
export default function SignOutButton({ className = '' }: { className?: string }) {
  const id = useId()
  const [unsent, setUnsent] = useState(0)

  return (
    <>
      <button type="button" popoverTarget={id} className={className}>
        Sign out
      </button>
      <div
        id={id}
        popover="auto"
        role="dialog"
        aria-labelledby={`${id}-title`}
        onToggle={(e) => {
          if (e.newState !== 'open') return
          try {
            setUnsent(readQueue(localStorage).length)
          } catch {
            setUnsent(0)
          }
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-left text-ink shadow-2xl backdrop:bg-black/50 overflow-y-auto"
      >
        <h2 id={`${id}-title`} className="text-lg font-extrabold">
          Sign out?
        </h2>
        <p className="mt-1 text-sm text-muted">You’ll need your name and the passcode to sign back in.</p>
        {unsent > 0 && (
          <p className="mt-3 rounded-xl bg-note p-3 text-sm font-semibold text-note-ink">
            {unsent === 1 ? '1 offline scan hasn’t' : `${unsent} offline scans haven’t`} been sent yet. Stay signed in until the
            internet is back.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2.5">
          {/* Cancel has focus, so Enter or a second tap in the same spot doesn't sign out. */}
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            autoFocus
            className="h-11 rounded-xl border border-line-strong px-4 font-semibold hover:bg-soft"
          >
            Cancel
          </button>
          <form action={signOutAction}>
            <button className="h-11 rounded-xl bg-bad px-4 font-bold text-on-flag hover:opacity-90">Sign out</button>
          </form>
        </div>
      </div>
    </>
  )
}
