'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { parseTicketList } from '@/lib/groups'
import { makePayload, ticketRange } from '@/lib/qr'
import { zip } from '@/lib/zip'
import Pager from '../Pager'
import { toast } from '../../toast'

const QR_PX = 480
const LABEL_PX = 96

/** One PNG: the QR code with the ticket number written under it. */
async function ticketPng(event: string, ticket: string): Promise<Blob> {
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, makePayload(event, ticket), { width: QR_PX, margin: 2, errorCorrectionLevel: 'M' })
  const out = document.createElement('canvas')
  out.width = QR_PX
  out.height = QR_PX + LABEL_PX
  const g = out.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, out.width, out.height)
  g.drawImage(qr, 0, 0)
  g.fillStyle = '#000'
  g.font = `bold ${Math.round(LABEL_PX * 0.7)}px system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(ticket, QR_PX / 2, QR_PX + LABEL_PX / 2 - 8)
  return new Promise((ok, fail) => out.toBlob((b) => (b ? ok(b) : fail(new Error('No image'))), 'image/png'))
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const n = (x: number) => x.toLocaleString('en')
const safe = (s: string) => s.replace(/[^\w.-]+/g, '-')

/** "57" finds every number containing 57; "500-600" or "12 57 103" finds exactly those tickets. */
function matches(all: string[], query: string): string[] {
  const q = query.trim()
  if (!q) return all
  if (/^\d+$/.test(q)) return all.filter((t) => t.includes(q))
  const p = parseTicketList(q)
  if (p.invalid.length) return []
  const want = new Set(p.numbers)
  return all.filter((t) => want.has(t))
}

const DownloadIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
)

export default function QrCodes({ event, from, to }: { event: string; from: string; to: string }) {
  const all = ticketRange(from, to)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')

  const found = matches(all, query)
  const current = Math.min(page, Math.max(0, Math.ceil(found.length / size) - 1))
  const shown = found.slice(current * size, current * size + size)
  const filtered = query.trim() !== '' && found.length > 0 && found.length < all.length

  async function downloadOne(ticket: string) {
    setError('')
    try {
      save(await ticketPng(event, ticket), `${ticket}.png`)
      toast(`Downloaded the QR code for ticket ${ticket}.`)
    } catch {
      setError(`Couldn’t make the image for ticket ${ticket}. Try again.`)
    }
  }

  async function downloadMany(tickets: string[], label: string) {
    setError('')
    setBusy({ done: 0, total: tickets.length })
    try {
      const files = []
      for (const [i, t] of tickets.entries()) {
        files.push({ name: `${t}.png`, data: new Uint8Array(await (await ticketPng(event, t)).arrayBuffer()) })
        if (i % 10 === 9) setBusy({ done: i + 1, total: tickets.length })
      }
      save(new Blob([zip(files)], { type: 'application/zip' }), `${safe(event)}-QR-codes${label}.zip`)
      toast(`Downloaded ${n(tickets.length)} QR code${tickets.length === 1 ? '' : 's'} in one zip file.`)
    } catch {
      setError('Couldn’t make the zip file. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const btn = 'flex h-10 items-center gap-2 rounded-lg px-3.5 text-[15px] font-semibold transition-colors duration-200 disabled:opacity-60'

  return (
    <section aria-label="QR codes" className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative block min-w-0 flex-[1_1_240px]">
          <span className="sr-only">Find ticket numbers</span>
          <svg className="pointer-events-none absolute top-3 left-3.5 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Number, or a run like 500-600"
            className="h-11 w-full rounded-lg border-[1.5px] border-line-strong bg-surface pr-3 pl-10 text-[15px] font-medium focus:border-primary focus:outline-none"
          />
        </label>
        {filtered && (
          <button
            disabled={!!busy}
            onClick={() => downloadMany(found, `-${found[0]}-${found[found.length - 1]}`)}
            className={`${btn} border border-line-strong hover:bg-soft`}
          >
            <DownloadIcon />
            Download these {n(found.length)}
          </button>
        )}
        <button disabled={!!busy} onClick={() => downloadMany(all, '')} className={`${btn} bg-primary font-bold text-primary-ink hover:bg-primary-hover`}>
          <DownloadIcon />
          Download all {n(all.length)}
        </button>
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {busy ? (
          <span className="font-semibold">
            Making QR codes… {n(busy.done)} of {n(busy.total)}
          </span>
        ) : error ? (
          <span className="font-semibold text-bad-text">{error}</span>
        ) : (
          <span className="text-muted">Download one, or all of them as a zip file. Each image is named by its ticket number, like 0057.png.</span>
        )}
      </p>

      {found.length === 0 ? (
        <p className="py-6 text-muted">
          No tickets match “{query}”. This event has tickets {from} to {to}.{' '}
          <button className="font-semibold text-primary underline" onClick={() => setQuery('')}>
            Show all
          </button>
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
          {shown.map((t) => (
            <QrCard key={t} event={event} ticket={t} onDownload={() => downloadOne(t)} />
          ))}
        </ul>
      )}

      {found.length > 0 && (
        <Pager
          page={current}
          size={size}
          total={found.length}
          onPage={setPage}
          onSize={(s) => {
            setSize(s)
            setPage(0)
          }}
        />
      )}
    </section>
  )
}

function QrCard({ event, ticket, onDownload }: { event: string; ticket: string; onDownload: () => void }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let live = true
    QRCode.toString(makePayload(event, ticket), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then((s) => live && setSvg(s))
    return () => {
      live = false
    }
  }, [event, ticket])

  return (
    <li className="flex flex-col items-center gap-2 rounded-xl border border-line p-3">
      <div
        role="img"
        aria-label={`QR code for ticket ${ticket}`}
        className="aspect-square w-full max-w-36 rounded bg-white p-1 [&_svg]:size-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span className="text-xl font-extrabold tabular-nums">{ticket}</span>
      <button
        onClick={onDownload}
        aria-label={`Download QR code for ticket ${ticket}`}
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong text-sm font-semibold transition-colors duration-200 hover:bg-soft"
      >
        <DownloadIcon size={16} />
        Download
      </button>
    </li>
  )
}
