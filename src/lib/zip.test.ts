import { expect, test } from 'vitest'
import { crc32, zip } from './zip'

const u32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint32(at, true)
const u16 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint16(at, true)

test('crc32 matches the standard check value', () => {
  expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
})

test('zip: files are stored with their names, and the directory at the end lists them all', () => {
  const files = [
    { name: '0001.png', data: new Uint8Array([1, 2, 3]) },
    { name: '0002.png', data: new Uint8Array([4, 5]) },
  ]
  const z = zip(files)
  expect(u32(z, 0)).toBe(0x04034b50) // first local file header
  expect(new TextDecoder().decode(z.slice(30, 38))).toBe('0001.png')
  expect([...z.slice(38, 41)]).toEqual([1, 2, 3])
  const end = z.length - 22
  expect(u32(z, end)).toBe(0x06054b50) // end of central directory
  expect(u16(z, end + 10)).toBe(2) // two entries
  const dir = u32(z, end + 16)
  expect(u32(z, dir)).toBe(0x02014b50)
  expect(u32(z, dir + 16)).toBe(crc32(files[0].data))
})
