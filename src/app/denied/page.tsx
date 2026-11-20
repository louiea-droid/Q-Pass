import Link from 'next/link'
import { signOutAction } from '../signin/actions'

export default function Denied() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 pt-16">
      <h1 className="text-3xl font-extrabold">Admins only</h1>
      <p className="text-[17px] leading-relaxed text-muted">
        You’re signed in with the scanner passcode. To open admin pages, sign out and sign in with the admin passcode.
      </p>
      <Link
        href="/scan"
        className="mt-4 flex h-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-ink hover:bg-primary-hover"
      >
        Back to scanning
      </Link>
      <form action={signOutAction}>
        <button className="h-14 w-full rounded-2xl border border-line-strong bg-surface text-lg font-semibold hover:bg-soft">
          Sign out
        </button>
      </form>
    </main>
  )
}
