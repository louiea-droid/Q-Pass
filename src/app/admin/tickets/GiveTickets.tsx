'use client'

import { useState, useTransition } from 'react'
import { giveTicketsAction } from '../../actions'
import { firstFreeRun, planGive } from '@/lib/groups'
import { normalizeTicket } from '@/lib/qr'

const input =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] font-medium focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none'

/** Give several tickets to one person (a family) in one go. */
export default function GiveTickets({
  event,
  rows,
  onGiven,
}: {
  event: string
  rows: { ticket: string; name: string }[]
  onGiven: (tickets: string[], name: string, info: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [info, setInfo] = useState('')
  const [count, setCount] = useState('1')
  const [start, setStart] = useState<string | null>(null) // null = suggest the first free run
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [pending, run] = useTransition()

  const n = Math.max(1, Math.min(50, Number(count) || 1))
  const suggested = firstFreeRun(rows, n)
  const from = start ?? suggested ?? ''
  const first = normalizeTicket(from)
  const plan = first ? planGive(rows, first, n, name) : null
  const last = plan?.tickets.at(-1)
  const problem = !from
    ? `There aren’t ${n} free tickets in a row. Pick a start number.`
    : !first
      ? 'Type a ticket number, like 0010.'
      : plan!.missing.length
        ? `There’s no ticket ${plan!.missing[0]} in this event.`
        : plan!.taken.length
          ? `Already given: ${plan!.taken.map((t) => `${t.ticket} (${t.name})`).join(', ')}.`
          : ''

  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setOpen(true)
            setDone('')
          }}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[15px] font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            <path d="M13 5v2M13 17v2M13 11v2" />
          </svg>
          Give tickets
        </button>
        <span className="text-sm text-muted">Give one or several tickets (a family) to one person.</span>
        {done && (
          <span role="status" className="text-sm font-semibold text-ok-text">
            {done}
          </span>
        )}
      </div>
    )

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border-2 border-primary/50 bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return setError('Type the name of the person receiving the tickets.')
        if (problem) return setError(problem)
        run(async () => {
          setError('')
          const r = await giveTicketsAction(event, first!, n, name, info).catch(() => ({
            error: 'Couldn’t save. Check the connection and try again.',
            given: undefined,
          }))
          if (r.error || !r.given) return setError(r.error ?? 'Couldn’t save.')
          onGiven(r.given, name.trim(), info.trim())
          setDone(
            r.given.length === 1
              ? `Gave ticket ${r.given[0]} to ${name.trim()}.`
              : `Gave ${r.given.length} tickets (${r.given[0]} to ${r.given.at(-1)}) to ${name.trim()}.`,
          )
          setName('')
          setInfo('')
          setCount('1')
          setStart(null)
          setOpen(false)
        })
      }}
    >
      <h2 className="text-base font-extrabold">Give tickets</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Name
          <input
            autoFocus
            value={name}
            autoComplete="off"
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          <span>
            Details <span className="font-medium text-muted">(optional)</span>
          </span>
          <input value={info} autoComplete="off" onChange={(e) => setInfo(e.target.value)} className={input} />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">
          How many
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => {
              setCount(e.target.value)
              setError('')
            }}
            className={`${input} w-24 tabular-nums`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Starting at ticket
          <input
            inputMode="numeric"
            value={from}
            onChange={(e) => {
              setStart(e.target.value)
              setError('')
            }}
            className={`${input} w-32 tabular-nums`}
          />
        </label>
        <p aria-live="polite" className={`pb-2.5 text-sm ${problem ? 'font-semibold text-bad' : 'text-muted'}`}>
          {problem ||
            (n === 1 ? (
              <>
                Ticket <strong className="text-ink">{first}</strong>
              </>
            ) : (
              <>
                Tickets <strong className="text-ink">{first}</strong> to <strong className="text-ink">{last}</strong>
              </>
            ))}
          {!problem && start === null && suggested && ' (the next free ones)'}
        </p>
      </div>
      {error && error !== problem && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending}
          className="flex h-10 min-w-36 items-center justify-center rounded-lg bg-primary px-4 text-[15px] font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? 'Giving…' : n === 1 ? 'Give ticket' : `Give ${n} tickets`}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="flex h-10 items-center rounded-lg border border-line-strong px-3.5 text-[15px] font-semibold hover:bg-soft"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
