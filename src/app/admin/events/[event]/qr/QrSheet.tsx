'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { makePayload, normalizeTicket, ticketRange } from '@/lib/qr'

export default function QrSheet({ event, from, to }: { event: string; from: string; to: string }) {
  const [range, setRange] = useState({ from, to })
  const [codes, setCodes] = useState<{ ticket: string; svg: string }[] | null>(null)

  const a = normalizeTicket(range.from)
  const b = normalizeTicket(range.to)
  const problem =
    !a || !b
      ? 'Enter ticket numbers like 0000.'
      : Number(a) > Number(b)
        ? 'The first number must not be bigger than the last.'
        : Number(a) < Number(from) || Number(b) > Number(to)
          ? `This event’s tickets go from ${from} to ${to}.`
          : ''

  useEffect(() => {
    if (problem || !a || !b) return
    let cancelled = false
    Promise.all(
      ticketRange(a, b).map(async (ticket) => ({
        ticket,
        svg: await QRCode.toString(makePayload(event, ticket), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
      })),
    ).then((c) => !cancelled && setCodes(c))
    return () => {
      cancelled = true
    }
  }, [event, a, b, problem])

  return (
    <>
      <style>{`
        @page { size: A4; margin: 10mm; }
        .qr-grid { display: grid; grid-template-columns: repeat(5, 38mm); gap: 0; justify-content: center; }
        .qr-label { width: 38mm; height: 39mm; border: 1px dashed #bbb; display: flex; flex-direction: column;
          align-items: center; justify-content: center; break-inside: avoid; background: #fff; color: #000; }
        .qr-label svg { width: 30mm; height: 30mm; }
        @media print { .qr-grid { margin: 0; } }
      `}</style>

      <form className="no-print mt-6 flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
        <label className="text-sm font-semibold">
          From ticket
          <input
            inputMode="numeric"
            value={range.from}
            onChange={(e) => {
              setCodes(null)
              setRange({ ...range, from: e.target.value })
            }}
            className="mt-1 block w-28 rounded-xl border border-line bg-surface px-3 py-2 tabular-nums"
          />
        </label>
        <label className="text-sm font-semibold">
          To ticket
          <input
            inputMode="numeric"
            value={range.to}
            onChange={(e) => {
              setCodes(null)
              setRange({ ...range, to: e.target.value })
            }}
            className="mt-1 block w-28 rounded-xl border border-line bg-surface px-3 py-2 tabular-nums"
          />
        </label>
        <button
          type="button"
          disabled={!!problem || !codes}
          onClick={() => window.print()}
          className="rounded-xl bg-primary px-5 py-2 font-semibold text-primary-ink disabled:opacity-60"
        >
          Print
        </button>
        <p role="status" className="basis-full text-sm">
          {problem ? (
            <span className="text-bad">{problem}</span>
          ) : codes ? (
            `${codes.length} codes, about ${Math.ceil(codes.length / 35)} A4 page${codes.length > 35 ? 's' : ''}.`
          ) : (
            'Making QR codes…'
          )}
        </p>
      </form>

      {!problem && codes && (
        <div className="qr-grid mt-6">
          {codes.map((c) => (
            <div key={c.ticket} className="qr-label">
              <div dangerouslySetInnerHTML={{ __html: c.svg }} role="img" aria-label={`QR code for ticket ${c.ticket}`} />
              <span className="font-sans text-xl font-bold tabular-nums">{c.ticket}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
