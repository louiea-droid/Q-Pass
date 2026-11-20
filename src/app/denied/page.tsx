import Link from 'next/link'
import { signOutAction } from '../signin/actions'

export default function Denied() {
  return (
    <section className="mx-auto mt-12 max-w-sm">
      <h1 className="font-serif text-3xl font-semibold">Admins only</h1>
      <p className="mt-3 text-muted">You’re signed in as a scanner. To open admin pages, sign out and sign in with the admin passcode.</p>
      <Link href="/scan" className="mt-8 block rounded-lg bg-pine px-4 py-3 text-center font-semibold text-pine-ink">
        Back to scanning
      </Link>
      <form action={signOutAction} className="mt-3">
        <button className="w-full rounded-lg border border-line px-4 py-3 font-semibold hover:bg-surface">Sign out</button>
      </form>
    </section>
  )
}
