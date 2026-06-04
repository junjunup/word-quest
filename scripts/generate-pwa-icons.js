/**
 * 生成 Word Quest PWA 图标
 * 纯 Node.js，零外部依赖 — 直接写入合法 PNG 文件
 *
 * 用法: node scripts/generate-pwa-icons.js
 * 输出: client/public/assets/ui/icon-192.png + icon-512.png
 */
import { createWriteStream } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import zlib from 'zlib'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT = join(__dirname, '..')
const UI_DIR = join(PROJECT, 'client', 'public', 'assets', 'ui')

// ---- PNG primitives ----
function crc32(buf) {
  // zlib.crc32 gives a signed int32 — flip to unsigned
  return (zlib.crc32(buf) >>> 0)
}

function makeChunk(type, data) {
  const typeLen = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeLen, data])))
  return Buffer.concat([len, typeLen, data, crc])
}

/**
 * Draw a pixel-art "WQ" monogram on a green field.
 * Returns raw RGBA pixel data (unfiltered — filter byte 0 per row).
 *
 * We build a stylized icon:
 *   - Background: #4A7C23 (Word Quest theme green)
 *   - Foreground: gold #FFD700
 *   - Shape: a book (open pages) + the letters W / Q hinted in pixel blocks
 */
function renderIcon(size) {
  const BG_R = 0x4a, BG_G = 0x7c, BG_B = 0x23
  const FG_R = 0xff, FG_G = 0xd7, FG_B = 0x00

  // Start with green background
  const pixels = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = BG_R
    pixels[i * 4 + 1] = BG_G
    pixels[i * 4 + 2] = BG_B
    pixels[i * 4 + 3] = 255
  }

  const setPx = (x, y, r, g, b) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const idx = (y * size + x) * 4
    pixels[idx] = r
    pixels[idx + 1] = g
    pixels[idx + 2] = b
    pixels[idx + 3] = 255
  }

  const fillRect = (x, y, w, h, r, g, b) => {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        setPx(x + dx, y + dy, r, g, b)
  }

  // Scale factor — design on a 48x48 grid, then scale up
  const grid = Math.floor(size / 48)
  const gs = Math.max(grid, 1)

  // Center offset
  const ox = Math.floor((size - 48 * gs) / 2)
  const oy = Math.floor((size - 35 * gs) / 2) // slightly top-aligned

  // === Pixel-art book icon ===
  // Book cover (dark brown)
  const bookPattern = [
    // Left page
    '.................@@@@@@@@@@@@@@.......',
    '................@@@@@@@@@@@@@@@@@......',
    '...............@@@@@@@@@@@@@@@@@@@.....',
    '..............@@@@@@@@@@@@@@@@@@@@@....',
    '.............@@@@@@@@@@@@@@@@@@@@@@@...',
    '............@@@@@@@@@@@@@@@@@@@@@@@@@..',
    '...........@@@@@@@@@@@@@@@@@@@@@@@@@@@.',
    '..........@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
    // Divider
    '.........@@@@@@@@@....@@@@@@@@@@@@@@@@@',
    '........@@@@@@@@......@@@@@@@@@@@@@@@@@',
    '.......@@@@@@@@......@@@@@@@@@@@@@@@@@@',
    '......@@@@@@@@@......@@@@@@@@@@@@@@@@@@',
    '.....@@@@@@@@@@......@@@@@@@@@@@@@@@@@@',
    '....@@@@@@@@@@@......@@@@@@@@@@@@@@@@@@',
    '...@@@@@@@@@@@@......@@@@@@@@@@@@@@@@@@',
    '..@@@@@@@@@@@@@......@@@@@@@@@@@@@@@@@@',
    '.@@@@@@@@@@@@@@......@@@@@@@@@@@@@@@@@@',
    '.@@@@@@@@@@@@@.@@@@@@@@@@@@@@@@@@@@@@@@',
    '.@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
    '.@@@@@@@@@@@@@@@@@@@@@@@..........@@@@@',
    '.@@@@@@@@@@@@@@@@@@@@@@...........@@@@@',
    '.@@@@@@@@@@@@@@@@@@@@@............@@@@@',
    '.@@@@@@@@@@@@@@@@@@@@.............@@@@@',
    '.@@@@@@@@@@@@@@@@@@@..............@@@@@',
    '.@@@@@@@@@@@@@@@@@@...............@@@@@',
    '..@@@@@@@@@@@@@@@@................@@@@@',
    '...@@@@@@@@@@@@@@.................@@@@@',
    '....@@@@@@@@@@@@..................@@@@@',
    '.....@@@@@@@@@@...................@@@@@',
    '......@@@@@@@@....................@@@@@',
    '.......@@@@@@.....................@@@@@',
    '........@@@@......................@@@@@',
    '.........@@.......................@@@@@',
    '..................................@@@@@',
    '.................................@@@@@@',
  ]

  // Draw the book pattern
  for (let row = 0; row < bookPattern.length; row++) {
    for (let col = 0; col < bookPattern[row].length; col++) {
      const ch = bookPattern[row][col]
      if (ch === '@') {
        // Dark brown book
        fillRect(ox + col * gs, oy + row * gs, gs, gs, 0x5c, 0x33, 0x16)
      } else if (ch === '.') {
        // Keep background green (already there — skip)
      }
    }
  }

  // Gold "WQ" text overlay — use 5x5 block letters centered on the book
  const textOx = ox + Math.floor(gs * 12)  // center of left half
  const textOy = oy + Math.floor(gs * 8)
  const textScale = Math.max(Math.floor(gs * 1.2), 1)
  const gap = gs * 9

  // Block letter "W" (5x5)
  const letterW = [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,1,0,1],
    [1,0,1,0,1],
    [0,1,0,1,0],
  ]

  // Block letter "Q" (5x5)
  const letterQ = [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
    [0,0,0,0,1],
  ]

  const drawLetter = (pattern, startX, startY, scale) => {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (pattern[row][col]) {
          fillRect(startX + col * scale, startY + row * scale, scale, scale, FG_R, FG_G, FG_B)
        }
      }
    }
  }

  // Draw W and Q in gold, centered
  const wStartX = textOx - Math.floor(textScale * 2.5)
  const qStartX = textOx + gap - Math.floor(textScale * 2.5)

  drawLetter(letterW, wStartX, textOy, textScale)
  drawLetter(letterQ, qStartX, textOy, textScale)

  // Bottom gold bar (like a bookmark ribbon)
  const ribbonY = oy + (bookPattern.length + 2) * gs
  const ribbonW = Math.floor(size * 0.5)
  const ribbonX = Math.floor((size - ribbonW) / 2)
  fillRect(ribbonX, ribbonY, ribbonW, Math.floor(gs * 1.5), FG_R, FG_G, FG_B)

  // Small gold leaf decoration in top-left corner
  const leafX = Math.floor(size * 0.1)
  const leafY = Math.floor(size * 0.1)
  const leafS = Math.floor(gs * 2)
  fillRect(leafX, leafY, leafS, leafS, FG_R, FG_G, FG_B) // simple square leaf
  fillRect(leafX - leafS, leafY + leafS, leafS, leafS, FG_R, FG_G, FG_B)
  fillRect(leafX + leafS, leafY + leafS, leafS, leafS, FG_R, FG_G, FG_B)

  return pixels
}

/**
 * Build a complete PNG file buffer from raw RGBA pixel data.
 * Each row is preceded by filter byte 0 (None).
 */
function buildPng(width, height, rgba) {
  // Filter each row
  const filteredRows = []
  for (let y = 0; y < height; y++) {
    const rowStart = y * width * 4
    const row = rgba.subarray(rowStart, rowStart + width * 4)
    filteredRows.push(Buffer.from([0])) // filter None
    filteredRows.push(row)
  }
  const rawData = Buffer.concat(filteredRows)

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData.writeUInt8(8, 8)  // bit depth
  ihdrData.writeUInt8(6, 9)  // color type: RGBA
  ihdrData.writeUInt8(0, 10) // compression
  ihdrData.writeUInt8(0, 11) // filter
  ihdrData.writeUInt8(0, 12) // interlace

  // IDAT — zlib compressed
  const compressed = zlib.deflateSync(rawData, { level: 9 })

  // IEND
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- Generate icons ----
const sizes = [192, 512]

for (const size of sizes) {
  const rgba = renderIcon(size)
  const png = buildPng(size, size, rgba)
  const outPath = join(UI_DIR, `icon-${size}.png`)
  const stream = createWriteStream(outPath)
  stream.write(png)
  stream.end()
  console.log(`✅ icon-${size}.png  (${(png.length / 1024).toFixed(1)} KB) → ${outPath}`)
}

console.log('\n🎨 PWA 图标生成完毕！')
