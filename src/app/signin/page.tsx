import { ensureSchema } from '@/lib/store'
import Logo from '../Logo'
import SignInForm from './SignInForm'
import ThemeToggle from '../ThemeToggle'

export default async function SignIn() {
  // Checks the database connection (and, in Sheet mode, creates the Events and Log tabs).
  const setupError = await ensureSchema().then(
    () => null,
    (e: Error) => e.message,
  )
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 pb-10 sm:px-6">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-3 text-xl font-extrabold text-primary">
          <Logo size={40} />
          Q-Pass
        </span>
        <ThemeToggle />
      </header>

      {/* Centred on tall screens, near the top on short ones. */}
      <section aria-labelledby="signin-title" className="my-auto flex flex-col gap-6 pt-10 pb-6">
        <h1 id="signin-title" className="text-3xl font-extrabold text-balance">
          Welcome
        </h1>
        {setupError && (
          <p role="alert" className="rounded-xl border border-bad p-3 text-sm text-bad-text">
            Can’t reach the database: {setupError}. Check the app’s settings (see README).
          </p>
        )}
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-[0_24px_50px_-30px_rgb(0_0_0/0.45)] sm:p-6">
          <SignInForm />
        </div>
      </section>
    </main>
  )
}
