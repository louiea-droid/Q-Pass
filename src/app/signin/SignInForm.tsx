'use client'

import { useActionState } from 'react'
import { signInAction } from './actions'

const input =
  'h-14 w-full rounded-xl border-[1.5px] border-line-strong bg-surface px-4 text-lg font-medium text-ink focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none'

export default function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, {})
  return (
    <form action={action} className="flex flex-col gap-4.5">
      <label className="flex flex-col gap-2 font-bold">
        Your name
        <input name="name" required autoComplete="name" maxLength={60} defaultValue={state.name} className={input} />
      </label>
      <label className="flex flex-col gap-2 font-bold">
        Passcode
        <input name="passcode" type="password" required autoComplete="current-password" className={input} />
      </label>
      {state.error && (
        <p role="alert" className="font-medium text-bad-text">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="mt-1.5 h-14 rounded-2xl bg-primary text-lg font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Start checking in'}
      </button>
    </form>
  )
}
