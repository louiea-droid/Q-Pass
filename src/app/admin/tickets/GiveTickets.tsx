'use client'

import { useState, useTransition } from 'react'
import { giveTicketsAction } from '../../actions'
import { parseTicketList, planGive } from '@/lib/groups'

const input =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] font-medium focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none'

/** The "Give tickets" button; the form opens below the table header. */
export function GiveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[15px] font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
        <path d="M13 5v2M13 17v2M13 11v2" />
      </svg>
      Give tickets
    </button>
  )
}

const list = (xs: string[]) => (xs.length <= 6 ? xs.join(', ') : `${xs.slice(0, 6).join(', ')} and ${xs.length - 6} more`)

/** Give one or several tickets (a family) to one person. Tickets are handed out at random, so you type their numbers. */
export default function GiveTickets({
  event,
  rows,
  onGiven,
  onClose,
  onDone,
}: {
  event: string
  rows: { ticket: string; name: string }[]
  onGiven: (tickets: string[], name: string, info: string) => void
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [info, setInfo] = useState('')
  const [numbersText, setNumbersText] = useState('')
  const [error, setError] = useState('')
  const [pending, run] = useTransition()

  const parsed = parseTicketList(numbersText)
  const plan = planGive(rows, parsed.numbers, name)
  const problem = parsed.invalid.length
    ? `Not a ticket number: ${parsed.invalid.join(', ')}.`
    : plan.missing.length
      ? `Not in this event: ${list(plan.missing)}.`
      : plan.taken.length
        ? `Already given: ${plan.taken.map((t) => `${t.ticket} (${t.name})`).join(', ')}.`
        : parsed.numbers.length > 50
          ? 'Give up to 50 tickets at a time.'
          : ''
  const n = parsed.numbers.length

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border-2 border-primary/50 bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return setError('Type the name of the person receiving the tickets.')
        if (!n) return setError('Type the ticket numbers you handed over.')
        if (problem) return setError(problem)
        run(async () => {
          setError('')
          const r = await giveTicketsAction(event, parsed.numbers, name, info).catch(() => ({
            error: 'Couldn’t save. Check the connection and try again.',
            given: undefined,
          }))
          if (r.error || !r.given) return setError(r.error ?? 'Couldn’t save.')
          onGiven(r.given, name.trim(), info.trim())
          onDone(
            r.given.length === 1
              ? `Gave ticket ${r.given[0]} to ${name.trim()}.`
              : `Gave ${r.given.length} tickets (${list(r.given)}) to ${name.trim()}.`,
          )
          onClose()
        })
      }}
    >
      <h2 className="text-base font-extrabold">
        Give tickets <span className="text-sm font-medium text-muted">to one person, or a family</span>
      </h2>
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
      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Ticket numbers
          <input
            value={numbersText}
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 12, 57, 103"
            aria-describedby="numbers-help"
            onChange={(e) => {
              setNumbersText(e.target.value)
              setError('')
            }}
            className={`${input} tabular-nums`}
          />
        </label>
        <p id="numbers-help" aria-live="polite" className={`text-sm ${problem ? 'font-semibold text-bad-text' : 'text-muted'}`}>
          {problem ||
            (n ? (
              <>
                {n === 1 ? 'Ticket' : `${n} tickets:`} <strong className="text-ink">{list(parsed.numbers)}</strong>
              </>
            ) : (
              'Type the numbers on the tickets you handed over, separated by commas. Use a dash for a run, like 10-14.'
            ))}
        </p>
      </div>
      {error && error !== problem && (
        <p role="alert" className="text-sm font-semibold text-bad-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending}
          className="flex h-10 min-w-36 items-center justify-center rounded-lg bg-primary px-4 text-[15px] font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? 'Giving…' : n > 1 ? `Give ${n} tickets` : 'Give ticket'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          className="flex h-10 items-center rounded-lg border border-line-strong px-3.5 text-[15px] font-semibold hover:bg-soft"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
