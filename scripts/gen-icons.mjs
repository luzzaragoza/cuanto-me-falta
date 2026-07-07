// Genera todos los assets de marca desde el SVG maestro del ícono (¿ sólido en
// cuadrado dorado). Rasteriza con el chromium de Playwright y arma el favicon.ico
// a mano. Correr con: node scripts/gen-icons.mjs   (regenera todo en public/)
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public')
mkdirSync(OUT, { recursive: true })

const GOLD = '#c39200'
const WHITE = '#ffffff'
const PAPER = '#f5f3ee'
const INK = '#232019'
const SOFT = '#6b655b'
const SERIF = "Georgia, 'Times New Roman', serif"

// ¿ en cuadrado dorado redondeado (transparente afuera del cuadrado).
const badge = (px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">` +
  `<rect x="4" y="4" width="92" height="92" rx="22" fill="${GOLD}"/>` +
  `<text x="50" y="76" text-anchor="middle" font-family="${SERIF}" font-size="74" font-weight="700" fill="${WHITE}">¿</text></svg>`

// ¿ a sangre completa (para apple-touch: iOS redondea solo).
const fullbleed = (px, fontSize = 74, y = 76) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">` +
  `<rect width="100" height="100" fill="${GOLD}"/>` +
  `<text x="50" y="${y}" text-anchor="middle" font-family="${SERIF}" font-size="${fontSize}" font-weight="700" fill="${WHITE}">¿</text></svg>`

// maskable: fondo dorado a sangre + ¿ dentro de la zona segura (~60% central).
const maskable = (px) => fullbleed(px, 52, 69)

// OG image 1200×630 (el preview al compartir el link). Copy genérico a propósito.
const ogHTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:${PAPER};font-family:${SERIF};
    padding:74px 84px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:14px}
  .mk{width:92px;height:92px}
  .brand{font-size:52px;font-weight:700;color:${INK};letter-spacing:-0.02em}
  .brand .q{color:${GOLD}}
  .head{font-size:88px;font-weight:700;color:${INK};line-height:1.04;letter-spacing:-0.02em}
  .sub{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:29px;color:${SOFT};margin-top:14px}
  .bar{display:flex;gap:8px;margin-top:30px}
  .bar i{height:16px;border-radius:8px}
</style></head><body>
  <div class="top">
    <span class="mk">${badge(92)}</span>
    <span class="brand">Cuánto me falta<span class="q">?</span></span>
  </div>
  <div>
    <div class="head">Seguí tu carrera<br>de un vistazo.</div>
    <div class="sub">Marcá tus materias, mirá las correlativas y calculá cuánto te falta para recibirte.</div>
    <div class="bar">
      <i style="background:#2f7d5a;width:360px"></i>
      <i style="background:#3d6bb3;width:96px"></i>
      <i style="background:#c2620f;width:72px"></i>
      <i style="background:#e4dfd4;width:380px"></i>
    </div>
  </div>
</body></html>`

// ── armado del favicon.ico (contenedor ICO alrededor de PNGs) ──
function packIco(images) {
  const count = images.length
  const dir = Buffer.alloc(6 + count * 16)
  dir.writeUInt16LE(0, 0)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(count, 4)
  let offset = 6 + count * 16
  const bodies = []
  images.forEach((img, i) => {
    const e = 6 + i * 16
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e)
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 1)
    dir.writeUInt8(0, e + 2)
    dir.writeUInt8(0, e + 3)
    dir.writeUInt16LE(1, e + 4)
    dir.writeUInt16LE(32, e + 6)
    dir.writeUInt32LE(img.data.length, e + 8)
    dir.writeUInt32LE(offset, e + 12)
    offset += img.data.length
    bodies.push(img.data)
  })
  return Buffer.concat([dir, ...bodies])
}

async function shotSVG(page, svg, px, transparent = true) {
  await page.setViewportSize({ width: px, height: px })
  await page.setContent(
    `<!doctype html><html><head><style>*{margin:0;padding:0}html,body{background:transparent}</style></head><body>${svg}</body></html>`,
    { waitUntil: 'load' },
  )
  return page.locator('svg').screenshot({ omitBackground: transparent })
}

const run = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: 1 })

  // favicon.svg (vectorial, lo escribimos tal cual)
  writeFileSync(join(OUT, 'favicon.svg'), badge(32))

  // favicon.ico (16 + 32)
  const p16 = await shotSVG(page, badge(16), 16)
  const p32 = await shotSVG(page, badge(32), 32)
  writeFileSync(join(OUT, 'favicon.ico'), packIco([{ size: 16, data: p16 }, { size: 32, data: p32 }]))

  // PWA "any" (badge transparente)
  writeFileSync(join(OUT, 'icon-192.png'), await shotSVG(page, badge(192), 192))
  writeFileSync(join(OUT, 'icon-512.png'), await shotSVG(page, badge(512), 512))

  // PWA maskable (fondo a sangre)
  writeFileSync(join(OUT, 'icon-maskable-192.png'), await shotSVG(page, maskable(192), 192, false))
  writeFileSync(join(OUT, 'icon-maskable-512.png'), await shotSVG(page, maskable(512), 512, false))

  // apple-touch (a sangre, iOS redondea)
  writeFileSync(join(OUT, 'apple-touch-icon.png'), await shotSVG(page, fullbleed(180), 180, false))

  // OG 1200×630
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.setContent(ogHTML, { waitUntil: 'load' })
  await page.screenshot({ path: join(OUT, 'og.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } })

  await browser.close()
  console.log('✓ Assets generados en public/')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
