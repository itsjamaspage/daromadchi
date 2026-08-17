/**
 * Generate every raster logo asset from the single SVG source of truth
 * (public/daromadchi-logo.svg — white "D" on a #2F6DF6 rounded square).
 * Rasters are always produced FROM the SVG, never by upscaling a small PNG.
 *
 * Outputs:
 *   public/icon-16.png icon-32.png apple-icon.png(180) icon-192.png icon-512.png
 *   public/favicon.ico  (PNG-in-ICO, 16+32)
 *   public/og-image.png (1200x630 social card: mark + wordmark + tagline)
 *   extension/icons/icon16.png icon48.png icon128.png
 *
 * Run: node scripts/gen-logo-assets.mjs   (needs sharp — already a dep)
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'public/daromadchi-logo.svg'
const svg = readFileSync(SRC)

async function png(size, out) {
  await sharp(svg).resize(size, size).png().toFile(out)
  console.log(`   ${out}  ${size}x${size}`)
}

// Wrap PNG frames in an ICO container (PNG-in-ICO — supported by every modern
// browser). ICONDIR (6 bytes) + one ICONDIRENTRY (16 bytes) per frame + data.
function buildIco(frames) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)             // reserved
  header.writeUInt16LE(1, 2)             // type: 1 = icon
  header.writeUInt16LE(frames.length, 4) // frame count
  let offset = 6 + frames.length * 16
  const entries = frames.map(({ size, buffer }) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0) // width  (0 means 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1) // height
    e.writeUInt8(0, 2)                       // palette count
    e.writeUInt8(0, 3)                       // reserved
    e.writeUInt16LE(1, 4)                    // color planes
    e.writeUInt16LE(32, 6)                   // bits per pixel
    e.writeUInt32LE(buffer.length, 8)        // image byte size
    e.writeUInt32LE(offset, 12)              // image offset
    offset += buffer.length
    return e
  })
  return Buffer.concat([header, ...entries, ...frames.map(f => f.buffer)])
}

async function main() {
  console.log('Website PNGs:')
  await png(16, 'public/icon-16.png')
  await png(32, 'public/icon-32.png')
  await png(180, 'public/apple-icon.png')
  await png(192, 'public/icon-192.png')
  await png(512, 'public/icon-512.png')

  console.log('favicon.ico:')
  const ico16 = await sharp(svg).resize(16, 16).png().toBuffer()
  const ico32 = await sharp(svg).resize(32, 32).png().toBuffer()
  writeFileSync('public/favicon.ico', buildIco([{ size: 16, buffer: ico16 }, { size: 32, buffer: ico32 }]))
  console.log('   public/favicon.ico  (16+32)')

  console.log('Extension icons:')
  await png(16, 'extension/icons/icon16.png')
  await png(48, 'extension/icons/icon48.png')
  await png(128, 'extension/icons/icon128.png')

  console.log('OG image (1200x630):')
  const mark = await sharp(svg).resize(240, 240).png().toBuffer()
  const ogBg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#EAF1FF"/><stop offset="1" stop-color="#FFFFFF"/>
    </linearGradient></defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <text x="600" y="452" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="90" font-weight="bold" fill="#0E1B2E">Daromadchi</text>
    <text x="600" y="512" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="32" fill="#5B6B84">Marketplace savdo tahlil platformasi</text>
  </svg>`)
  await sharp(ogBg)
    .composite([{ input: mark, top: 120, left: Math.round((1200 - 240) / 2) }])
    .png()
    .toFile('public/og-image.png')
  console.log('   public/og-image.png')

  console.log('\nDone.')
}
main().catch(e => { console.error(e); process.exit(1) })
