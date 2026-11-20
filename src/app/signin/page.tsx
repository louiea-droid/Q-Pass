import { ensureSchema } from '@/lib/store'
import Logo from '../Logo'
import SignInForm from './SignInForm'

export const metadata = { title: 'Sign in · Q-Pass' }

export default async function SignIn() {
  // Checks the database connection (and, in Sheet mode, creates the Events and Log tabs).
  const setupError = await ensureSchema().then(
    () => null,
    (e: Error) => e.message,
  )
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-6 pt-16 pb-8">
      <div className="flex flex-col gap-3.5">
        <Logo />
        <h1 className="text-3xl font-extrabold">Welcome</h1>
        <p className="text-[17px] leading-relaxed text-muted">Type your name and the passcode from your team leader.</p>
      </div>
      {setupError && (
        <p role="alert" className="rounded-xl border border-bad p-3 text-sm text-bad">
          Can’t reach the database: {setupError}. Check the app’s settings (see README).
        </p>
      )}
      <SignInForm />
      <p className="mt-auto rounded-xl bg-note p-4 text-[15px] leading-relaxed text-note-ink">
        Your name appears next to every person you check in, so the team knows who helped whom.
      </p>
    </main>
  )
}
