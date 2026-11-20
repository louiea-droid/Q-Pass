// A minimal .zip writer: files are stored, not compressed (PNGs are already compressed).
// ponytail: no zip64, so the archive must stay under 4 GB / 65,535 files. ~1,000 QR images is a few MB.

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const b of data) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const DATE = (1 << 5) | 1 // 1980-01-01 in DOS format; the archive doesn't need real times

export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)
    const head = (size: number) => {
      const b = new Uint8Array(size + name.length)
      b.set(name, size)
      return { b, v: new DataView(b.buffer) }
    }
    const l = head(30)
    l.v.setUint32(0, 0x04034b50, true)
    l.v.setUint16(4, 20, true)
    l.v.setUint16(6, 0x0800, true) // names are UTF-8
    l.v.setUint16(12, DATE, true)
    l.v.setUint32(14, crc, true)
    l.v.setUint32(18, f.data.length, true)
    l.v.setUint32(22, f.data.length, true)
    l.v.setUint16(26, name.length, true)
    const c = head(46)
    c.v.setUint32(0, 0x02014b50, true)
    c.v.setUint16(4, 20, true)
    c.v.setUint16(6, 20, true)
    c.v.setUint16(8, 0x0800, true)
    c.v.setUint16(14, DATE, true)
    c.v.setUint32(16, crc, true)
    c.v.setUint32(20, f.data.length, true)
    c.v.setUint32(24, f.data.length, true)
    c.v.setUint16(28, name.length, true)
    c.v.setUint32(42, offset, true)
    locals.push(l.b, f.data)
    centrals.push(c.b)
    offset += l.b.length + f.data.length
  }
  const dirSize = centrals.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const v = new DataView(end.buffer)
  v.setUint32(0, 0x06054b50, true)
  v.setUint16(8, files.length, true)
  v.setUint16(10, files.length, true)
  v.setUint32(12, dirSize, true)
  v.setUint32(16, offset, true)
  const parts = [...locals, ...centrals, end]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
