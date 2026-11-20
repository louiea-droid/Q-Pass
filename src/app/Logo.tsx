/** The scan-frame mark used on sign-in and in the admin header. */
export default function Logo({ size = 56 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-2xl bg-primary"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.54} height={size * 0.54} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-ink">
        <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
        <rect x="7" y="7" width="4" height="4" rx="0.5" />
        <rect x="13" y="13" width="4" height="4" rx="0.5" />
        <path d="M13 7h4v4M7 13v4h4" />
      </svg>
    </span>
  )
}
