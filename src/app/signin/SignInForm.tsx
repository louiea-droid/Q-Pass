'use client'

import { useActionState, useState } from 'react'
import Loading from '../Loading'
import { signInAction } from './actions'

const field =
  'h-14 w-full rounded-xl border-[1.5px] border-line-strong bg-paper pr-4 pl-12 text-lg font-medium text-ink placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none'
const icon = 'pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted'

export default function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, {})
  const [show, setShow] = useState(false)
  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Covers the wait while the passcode is checked and the desk or scanner loads. */}
      {pending && <Loading fullscreen label="Signing you in…" />}
      <label className="flex flex-col gap-2 font-bold">
        Your name
        <span className="relative">
          <svg className={icon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          <input name="name" required autoComplete="name" maxLength={60} defaultValue={state.name} placeholder="e.g. Maria" className={field} />
        </span>
      </label>
      <label className="flex flex-col gap-2 font-bold">
        Passcode
        <span className="relative">
          <svg className={icon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <input
            name="passcode"
            type={show ? 'text' : 'password'}
            required
            autoComplete="current-password"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Team passcode"
            className={`${field} pr-14`}
          />
          {/* Passcodes are easy to mistype on a phone keyboard, so let people check what they typed. */}
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide passcode' : 'Show passcode'}
            aria-pressed={show}
            className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {show && <path d="M3 3l18 18" />}
            </svg>
          </button>
        </span>
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2.5 text-[15px] font-semibold text-bad-text">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="mt-1 flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Start checking in'}
        {!pending && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>
    </form>
  )
}
