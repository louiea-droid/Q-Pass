'use client'

import { useActionState } from 'react'
import { signInAction } from './actions'

const input = 'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-3 text-lg'

export default function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, {})
  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="block font-semibold">
        Your name
        <input name="name" required autoComplete="name" maxLength={60} placeholder="Ana" defaultValue={state.name} className={input} />
      </label>
      <label className="block font-semibold">
        Passcode
        <input name="passcode" type="password" required autoComplete="current-password" className={input} />
      </label>
      {state.error && (
        <p role="alert" className="text-bad">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-pine px-4 py-3 text-lg font-semibold text-pine-ink hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
