'use client'

import { useState } from 'react'

/** "Share scanner": a QR code and link that open the scanner sign-in on a volunteer's phone, plus the scanner passcode. */
export default function ShareScanner({
  url,
  qrSvg,
  passcode,
  localOnly,
  iconOnly = false,
}: {
  url: string
  qrSvg: string
  passcode: string
  localOnly: boolean
  iconOnly?: boolean
}) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState('')

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(`${what} copied.`)
    } catch {
      setCopied(`Couldn’t copy here. Select the ${what.toLowerCase()} and copy it by hand.`)
    }
  }

  const btn = 'flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] font-semibold transition-colors duration-200 hover:bg-soft'

  return (
    <>
      <button
        popoverTarget="share-scanner"
        aria-label={iconOnly ? 'Share scanner' : undefined}
        title={iconOnly ? 'Share scanner' : undefined}
        className={
          iconOnly
            ? 'grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink transition-colors duration-200 hover:bg-soft'
            : btn
        }
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        {!iconOnly && 'Share scanner'}
      </button>

      <div
        id="share-scanner"
        popover="auto"
        aria-labelledby="share-title"
        onToggle={() => {
          setShow(false)
          setCopied('')
        }}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="share-title" className="text-lg font-extrabold">
            Share the scanner
          </h2>
          <button
            popoverTarget="share-scanner"
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
          Volunteers point their phone camera here, then sign in with their name and the scanner passcode. They only see the
          scanner.
        </p>

        <div
          role="img"
          aria-label={`QR code that opens ${url}`}
          className="mx-auto mt-4 size-52 rounded-xl bg-white p-2 [&_svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        {localOnly && (
          <p className="mt-3 rounded-xl bg-note p-3 text-sm text-note-ink">
            This link only opens on this computer. Put the site online (see README, Netlify) so volunteers’ phones can open it.
          </p>
        )}

        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="font-bold">Link</dt>
            <dd className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate rounded-lg bg-soft px-3 py-2 font-medium select-all" title={url}>
                {url}
              </span>
              <button onClick={() => copy(url, 'Link')} className="h-9 shrink-0 rounded-lg border border-line-strong px-3 font-semibold hover:bg-soft">
                Copy
              </button>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-bold">Scanner passcode</dt>
            <dd className="flex items-center gap-2">
              <span className="min-w-0 flex-1 rounded-lg bg-soft px-3 py-2 font-bold tracking-wide tabular-nums select-all">
                {show ? passcode || 'Not set (see README)' : '••••••'}
              </span>
              <button
                onClick={() => setShow((s) => !s)}
                aria-pressed={show}
                className="h-9 shrink-0 rounded-lg border border-line-strong px-3 font-semibold hover:bg-soft"
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </dd>
          </div>
        </dl>
        <p role="status" className="mt-3 min-h-5 text-sm font-semibold text-ok-text">
          {copied}
        </p>
      </div>
    </>
  )
}
