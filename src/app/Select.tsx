import type { ReactNode, SelectHTMLAttributes } from 'react'

/**
 * The one dropdown style. A real <select> (keyboard, screen readers and phone pickers keep working);
 * browsers that support `appearance: base-select` also get a styled list (see .select in globals.css).
 */
export default function Select({
  label,
  icon,
  compact = false,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; icon?: ReactNode; compact?: boolean; children: ReactNode }) {
  return (
    <label
      className={`group relative flex min-w-0 items-center rounded-xl border border-line-strong bg-surface text-ink transition-colors duration-200 hover:border-muted hover:bg-soft has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring ${
        compact ? 'h-9' : 'h-11'
      } ${className}`}
    >
      <span className="sr-only">{label}</span>
      {icon && (
        <span className="pointer-events-none absolute left-3 flex text-muted" aria-hidden="true">
          {icon}
        </span>
      )}
      <select
        {...props}
        className={`select h-full w-full min-w-0 cursor-pointer appearance-none truncate rounded-xl bg-transparent font-semibold outline-none ${
          compact ? 'pr-8 pl-3 text-sm tabular-nums' : 'pr-10 text-[15px]'
        } ${icon ? 'pl-9' : compact ? '' : 'pl-4'}`}
      >
        {children}
      </select>
      <svg
        className={`pointer-events-none absolute text-muted transition-colors group-hover:text-ink ${compact ? 'right-2.5' : 'right-3.5'}`}
        width={compact ? 14 : 16}
        height={compact ? 14 : 16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  )
}
