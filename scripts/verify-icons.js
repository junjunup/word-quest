import { readFileSync } from 'fs'
const base = new URL('../../client/public/assets/ui/', import.meta.url).pathname
for (const size of [192, 512]) {
  const path = base + `icon-${size}.png`
  const buf = readFileSync(path)
  console.log(`icon-${size}.png: ${buf.length} bytes`)
  console.log(`  valid PNG: ${buf[0]===137 && buf[1]===80 && buf[2]===78 && buf[3]===71}`)
  console.log(`  IHDR: ${buf.subarray(12, 16).toString()}`)
  console.log(`  dims: ${buf.readUInt32BE(16)} x ${buf.readUInt32BE(20)}`)
}
