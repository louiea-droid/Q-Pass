import { signIn } from '@/auth'
import { ensureSchema } from '@/lib/store'

export default async function SignIn() {
  // First visit on a fresh Sheet creates the Staff / Events / Log tabs.
  const setupError = await ensureSchema().then(
    () => null,
    (e: Error) => e.message,
  )
  return (
    <section className="mx-auto mt-12 max-w-sm">
      <h1 className="font-serif text-3xl font-semibold">Sign in to check people in</h1>
      <p className="mt-3 text-muted">Use the Google account your admin added to the staff list.</p>
      {setupError && (
        <p role="alert" className="mt-4 rounded-md border border-bad p-3 text-sm text-bad">
          Can’t reach the Google Sheet: {setupError}. Check the app’s settings (see README).
        </p>
      )}
      <form
        className="mt-8"
        action={async () => {
          'use server'
          await signIn('google', { redirectTo: '/' })
        }}
      >
        <button className="w-full rounded-lg bg-pine px-4 py-3 text-lg font-semibold text-pine-ink hover:opacity-90">
          Sign in with Google
        </button>
      </form>
    </section>
  )
}
