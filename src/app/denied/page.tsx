import { signOut } from '@/auth'

export default function Denied() {
  return (
    <section className="mx-auto mt-12 max-w-sm">
      <h1 className="font-serif text-3xl font-semibold">You’re not on the staff list</h1>
      <p className="mt-3 text-muted">
        Ask an admin to add your Google email to the Staff tab with Active set to TRUE, then sign in again. Scanners
        can’t open admin pages.
      </p>
      <form
        className="mt-8"
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/signin' })
        }}
      >
        <button className="w-full rounded-lg border border-line px-4 py-3 font-semibold hover:bg-surface">
          Sign in with a different account
        </button>
      </form>
    </section>
  )
}
