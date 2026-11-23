'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { importGuestsAction } from '../../actions'

type Result = Awaited<ReturnType<typeof importGuestsAction>>

const list = (xs: (string | number)[]) => (xs.length > 12 ? `${xs.slice(0, 12).join(', ')} and ${xs.length - 12} more` : xs.join(', '))

/** "Import names": put names from a CSV guest list onto tickets. */
export default function ImportGuests({ event, closed }: { event: string; closed: boolean }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setResult(null)
    try {
      const r = await importGuestsAction(event, await file.text())
      setResult(r)
      if (!r.error) router.refresh()
    } catch {
      setResult({ error: 'Couldn’t import. Check the internet connection and try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        popoverTarget="import-guests"
        disabled={closed}
        title={closed ? 'This event is closed' : undefined}
        className="flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] font-semibold transition-colors duration-200 hover:bg-soft disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 15V3M7 8l5-5 5 5M5 21h14" />
        </svg>
        Import names
      </button>

      <div
        id="import-guests"
        popover="auto"
        role="dialog"
        aria-labelledby="import-title"
        onToggle={(e) => {
          if (e.newState === 'open') {
            setFile(null)
            setResult(null)
          }
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="import-title" className="text-lg font-extrabold">
            Import names
          </h2>
          <button
            popoverTarget="import-guests"
            popoverTargetAction="hide"
            aria-label="Close"
            className="-mt-1 -mr-1 flex size-9 items-center justify-center rounded-lg text-muted hover:bg-soft hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          A CSV file from Excel or Google Sheets. Columns: Ticket, Name, and optional Details and Notes. Blank cells keep what’s
          already there. A file from Download list works too.
        </p>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <label htmlFor="import-file" className="text-sm font-bold">
            Guest list file
          </label>
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded-lg border border-line-strong bg-paper p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-soft file:px-3 file:py-1.5 file:font-semibold file:text-ink"
          />
          <button
            disabled={!file || busy}
            className="h-11 rounded-xl bg-primary font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
        </form>

        <div role="status" className="mt-3 flex flex-col gap-2 text-sm empty:hidden">
          {result?.error && <p className="rounded-xl border border-bad p-3 font-semibold text-bad-text">{result.error}</p>}
          {result && !result.error && (
            <p className="font-semibold text-ok-text">
              {result.updated === 1 ? '1 ticket updated.' : `${result.updated ?? 0} tickets updated.`}
            </p>
          )}
          {!!result?.unknown?.length && (
            <p className="rounded-xl bg-note p-3 text-note-ink">Not in this event, skipped: {list(result.unknown)}</p>
          )}
          {!!result?.badLines?.length && (
            <p className="rounded-xl bg-note p-3 text-note-ink">No ticket number on line {list(result.badLines)}, skipped.</p>
          )}
        </div>
      </div>
    </>
  )
}
