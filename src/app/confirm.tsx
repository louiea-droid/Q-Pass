'use client'

import { createRoot } from 'react-dom/client'

type Ask = { title: string; message: string; action: string }

/** The app's replacement for window.confirm: same "await yes/no", but styled like the rest of Q-Pass. */
export function confirmDialog(ask: Ask): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.body.appendChild(document.createElement('div'))
    const root = createRoot(host)
    const done = (ok: boolean) => {
      resolve(ok)
      setTimeout(() => {
        root.unmount()
        host.remove()
      })
    }
    root.render(<ConfirmDialog {...ask} onDone={done} />)
  })
}

function ConfirmDialog({ title, message, action, onDone }: Ask & { onDone: (ok: boolean) => void }) {
  return (
    // Native modal <dialog>: traps focus, Esc cancels. A tap on the dimmed backdrop cancels too.
    <dialog
      ref={(d) => {
        if (d && !d.open) d.showModal()
      }}
      aria-labelledby="confirm-title"
      onClose={(e) => onDone(e.currentTarget.returnValue === 'ok')}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <form method="dialog" className="p-5">
        <h2 id="confirm-title" className="text-lg font-extrabold">
          {title}
        </h2>
        <p className="mt-1 text-[15px] text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2.5">
          {/* Cancel has focus, so Enter or a double tap doesn't confirm by accident. */}
          <button value="cancel" autoFocus className="h-11 rounded-xl border border-line-strong px-4 font-semibold hover:bg-soft">
            Cancel
          </button>
          <button value="ok" className="h-11 rounded-xl bg-bad px-4 font-bold text-on-flag hover:opacity-90">
            {action}
          </button>
        </div>
      </form>
    </dialog>
  )
}
