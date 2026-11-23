import { headers } from 'next/headers'
import QRCode from 'qrcode'
import ShareScanner from './ShareScanner'

/** Builds the scanner link + QR on the server. Admin-only: the popover shows the scanner passcode. */
export default async function ScannerShare({ iconOnly = false }: { iconOnly?: boolean }) {
  // The scanner link uses the address this page was opened at, so it is right on a PC, a hotspot or online.
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const url = `${h.get('x-forwarded-proto') ?? 'http'}://${host}/scan`
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  return (
    <ShareScanner
      url={url}
      qrSvg={qrSvg}
      passcode={process.env.SCANNER_PASSCODE ?? ''}
      localOnly={['localhost', '127.', '[::1]'].some((p) => host.startsWith(p))}
      iconOnly={iconOnly}
    />
  )
}
