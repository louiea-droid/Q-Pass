import Logo from './Logo'

/** The one loading view: logo inside a spinning ring, with a short line of text. */
export default function Loading({ label = 'Loading…', fullscreen = false }: { label?: string; fullscreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-5 ${
        fullscreen ? 'fixed inset-0 z-50 bg-paper/95 backdrop-blur-sm' : 'flex-1 py-24'
      }`}
    >
      <span className="relative flex size-24 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-soft border-t-accent" aria-hidden="true" />
        <Logo size={52} />
      </span>
      <p className="text-[17px] font-semibold text-muted">{label}</p>
    </div>
  )
}
