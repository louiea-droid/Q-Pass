'use client'

import { useRef } from 'react'

type Topic = { q: string; steps: string[] }

const SCANNING: Topic[] = [
  {
    q: 'Scan a ticket',
    steps: [
      'Pick the event from the list at the top. The phone remembers it next time.',
      'Hold the QR code inside the frame. It scans by itself.',
      'Green “Welcome! Checked in” means let them in.',
      'Red means stop. Read the reason, then tap “Next person” to keep scanning.',
    ],
  },
  {
    q: 'What the red results mean',
    steps: [
      '“Already used”: someone already came in with this ticket. Don’t let them in yet. Ask an admin.',
      '“Ticket for a different event”: check that the event at the top is the right one.',
      '“Not a valid ticket”: the code isn’t a Q-Pass ticket. Ask an admin.',
      '“This event is closed”: an admin closed check-in. Ask them to reopen it.',
    ],
  },
  {
    q: 'The code won’t scan',
    steps: [
      'Use the flashlight button if it’s dark, and flatten creased paper.',
      'Still nothing? Tap “Type a ticket number” and type the number printed on the ticket.',
    ],
  },
  {
    q: 'The internet dropped',
    steps: [
      'Keep scanning. An amber “Saved offline” card means let them in.',
      'The scans are checked once the phone is back online. Keep this page open until then.',
    ],
  },
]

const ADMIN: Topic[] = [
  {
    q: 'Set up an event',
    steps: [
      'Go to Events, type the name, date, venue and ticket numbers, then tap “Create event”.',
      'Choose the name carefully. It’s printed inside every QR code, so it can’t be changed later.',
    ],
  },
  {
    q: 'Give out tickets',
    steps: [
      'For one person, find their ticket number in the table, click the Name cell and type their name.',
      'For a family or several tickets, use “Give tickets”: type the name and the ticket numbers. A dash adds a run, like 10-14.',
      'Have a guest list? Use Import to bring it in from a file.',
    ],
  },
  {
    q: 'Edit names, details and notes',
    steps: [
      'Click any cell in the table to change it. A dash (—) means it’s empty.',
      'Press Enter or click away to save. Esc undoes what you typed.',
      'A note too long for its cell opens in a bigger box. Shift+Enter starts a new line.',
    ],
  },
  {
    q: 'Print the QR codes',
    steps: ['On QR codes, download one ticket’s code, or all of them as a zip file to print.'],
  },
  {
    q: 'Get volunteers scanning',
    steps: [
      'Tap “Share scanner”. Volunteers scan that QR code with their phone and sign in with the scanner passcode shown there.',
      'Their phones must be on the same network as this computer unless Q-Pass is online.',
    ],
  },
  {
    q: 'Check someone in by hand, or undo it',
    steps: [
      'On the Check-in desk, search by name or ticket number and tap “Check in”.',
      'Let someone in by mistake? Use Undo next to their check-in.',
    ],
  },
  {
    q: 'After the event',
    steps: [
      'On Events, close the event so no more tickets can be scanned. You can reopen it later.',
      'The event page shows who came, when they arrived, and the no-shows.',
    ],
  },
]

/** "?" button that opens the how-tos. Admins see everything; volunteers see the scanning help only. */
export default function HelpButton({ admin = false }: { admin?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const groups: [string, Topic[]][] = admin ? [['Running an event', ADMIN], ['At the door', SCANNING]] : [['At the door', SCANNING]]
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label="Help"
        title="Help"
        className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-lg font-extrabold text-ink transition-colors duration-200 hover:bg-soft"
      >
        ?
      </button>
      {/* Native modal <dialog>: traps focus, Esc closes. A tap on the dimmed backdrop closes too. */}
      <dialog
        ref={ref}
        aria-labelledby="help-title"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h2 id="help-title" className="text-lg font-extrabold">
            How to use Q-Pass
          </h2>
          <form method="dialog">
            <button aria-label="Close help" className="grid size-10 place-items-center rounded-full text-2xl leading-none hover:bg-soft">
              ×
            </button>
          </form>
        </div>
        <div className="flex flex-col gap-5 p-5">
          {groups.map(([title, topics]) => (
            <section key={title} className="flex flex-col gap-2">
              {admin && <h3 className="text-sm font-bold text-muted">{title}</h3>}
              {topics.map((t) => (
                <details key={t.q} className="group rounded-xl border border-line open:bg-soft/50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                    {t.q}
                    <span aria-hidden="true" className="text-muted transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <ul className="flex list-disc flex-col gap-1.5 pr-4 pb-4 pl-9 text-[15px] text-muted">
                    {t.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </section>
          ))}
        </div>
      </dialog>
    </>
  )
}
