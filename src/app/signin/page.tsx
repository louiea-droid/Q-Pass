import { ensureSchema } from '@/lib/store'
import SignInForm from './SignInForm'

export default async function SignIn() {
  // Checks the database connection (and, in Sheet mode, creates the Events and Log tabs).
  const setupError = await ensureSchema().then(
    () => null,
    (e: Error) => e.message,
  )
  return (
    <section className="mx-auto mt-12 max-w-sm">
      <h1 className="font-serif text-3xl font-semibold">Sign in to check people in</h1>
      <p className="mt-3 text-muted">Use the passcode your admin gave you. Your name is recorded with each check-in.</p>
      {setupError && (
        <p role="alert" className="mt-4 rounded-md border border-bad p-3 text-sm text-bad">
          Can’t reach the database: {setupError}. Check the app’s settings (see README).
        </p>
      )}
      <SignInForm />
    </section>
  )
}
