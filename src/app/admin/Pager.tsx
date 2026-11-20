'use client'

import { pageList } from '@/lib/pagination'

const SIZES = [10, 25, 50, 100]

/** "Showing 1–25 of 1,001" · ‹ 1 2 3 … 41 › · Show [25]. `page` is 0-based. */
export default function Pager({
  page,
  size,
  total,
  onPage,
  onSize,
}: {
  page: number
  size: number
  total: number
  onPage: (page: number) => void
  onSize: (size: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  const from = total ? page * size + 1 : 0
  const to = Math.min(total, (page + 1) * size)
  const arrow =
    'flex size-9 items-center justify-center rounded-lg border border-line text-muted transition-colors duration-200 hover:bg-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40'

  return (
    <div className="grid grid-cols-1 items-center gap-3 border-t border-line pt-3 text-sm text-muted sm:grid-cols-[1fr_auto_1fr]">
      <p>
        Showing{' '}
        <strong className="text-ink tabular-nums">
          {from.toLocaleString('en')}–{to.toLocaleString('en')}
        </strong>{' '}
        of <span className="tabular-nums">{total.toLocaleString('en')}</span>
      </p>

      <nav aria-label="Pages" className="flex items-center justify-center gap-1">
        <button disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page" className={arrow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {pageList(page + 1, pages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="w-6 text-center" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p - 1)}
              aria-label={`Page ${p}`}
              aria-current={p === page + 1 ? 'page' : undefined}
              className={`h-9 min-w-9 rounded-lg px-2 font-semibold tabular-nums transition-colors duration-200 ${
                p === page + 1 ? 'bg-primary text-primary-ink' : 'text-ink hover:bg-soft'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Next page" className={arrow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </nav>

      <label className="flex items-center gap-2 sm:justify-self-end">
        Show
        <span className="relative flex h-9 items-center rounded-lg border border-line-strong bg-surface">
          <select
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
            className="h-full appearance-none rounded-lg bg-transparent pr-8 pl-3 font-semibold text-ink tabular-nums"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </label>
    </div>
  )
}
