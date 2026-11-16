// Genera todos los assets de marca desde el SVG maestro del ícono (el "¿" en tinta
// sobre un casillero pintado con resaltador). Rasteriza con el chromium de Playwright
// y arma el favicon.ico a mano. Correr con: node scripts/gen-icons.mjs   (regenera
// todo en public/)
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public')
mkdirSync(OUT, { recursive: true })

// Sistema Libreta (16-nov). Estos valores son la MISMA paleta que el bloque :root de
// global.css: si cambia allá, se actualiza acá y se vuelve a correr el script — si
// no, el ícono de la pestaña queda de otra app que la de adentro.
const TINTA = '#24388a'
const RESALTA = '#ffe45c'
const PAPER = '#f6f5f1'
const CARD = '#ffffff'
const INK = '#151b33'
const SOFT = '#5b6173'
const LINE = '#e3e1da'
const SUNK = '#ecebe5'
const AP = '#1d8a57'
const FI = '#d9630f'
const CU = '#7c4dc9'
const CU_BG = '#e7dcf8'

// El "¿" NO es texto: es el contorno del glifo de Archivo ExtraBold, en unidades de
// la fuente (1000/em, línea de base en 0). Un <text> depende de que la fuente esté
// cargada, y en un favicon no lo está nunca. Es el mismo trazo que usa la app en
// `src/components/Logo.tsx`: si cambia allá, cambia acá.
const TRAZO =
  'M327 172Q275 172 232 163Q189 154 156 137Q123 120 100.5 96.5Q78 73 66.5 43.5Q55 14 55-20Q55-58 69-87Q83-116 105-137.5Q127-159 152-176Q177-193 199-208Q221-223 235-238Q249-253 249-272L249-293L414-293L414-250Q414-224 401.5-203.5Q389-183 370-166Q351-149 329-133.5Q307-118 287.5-102.5Q268-87 255.5-69Q243-51 243-28Q243-15 248.5-1.5Q254 12 265.5 22.5Q277 33 296 39.5Q315 46 343 46Q378 46 399.5 37Q421 28 432.5 14.5Q444 1 448.5-15.5Q453-32 453-46Q453-54 452.5-60.5Q452-67 451-73L617-73Q619-65 620-56Q621-47 621-36Q621 0 608 31.5Q595 63 570.5 88.5Q546 114 510.5 133Q475 152 429 162Q383 172 327 172M426-356L235-356L235-527L426-527Z'
// La caja del trazo: x 55…621, y −527…172 → 566×699, centro (338, −177,5).
// `signo(alto)` lo deja centrado en un lienzo de 100×100 con ese alto.
const signo = (alto, color = TINTA) => {
  const k = alto / 699
  const tx = (50 - 338 * k).toFixed(2)
  const ty = (50 + 177.5 * k).toFixed(2)
  return `<path d="${TRAZO}" transform="translate(${tx} ${ty}) scale(${k.toFixed(4)})" fill="${color}"/>`
}

// El casillero redondeado (transparente afuera).
const badge = (px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">` +
  `<rect x="4" y="4" width="92" height="92" rx="22" fill="${RESALTA}"/>${signo(58)}</svg>`

// A sangre completa (para apple-touch: iOS redondea solo).
const fullbleed = (px, alto = 58) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">` +
  `<rect width="100" height="100" fill="${RESALTA}"/>${signo(alto)}</svg>`

// maskable: fondo a sangre + el signo dentro de la zona segura (~60% central).
const maskable = (px) => fullbleed(px, 44)

// OG image 1200×630 (el preview al compartir el link). Muestra lo mismo que la app
// apenas se abre: la respuesta resaltada y el mapa de la carrera. El avance es de
// ejemplo — 5 años, dos filas por año, como el plan de Ing. en Informática.
const MAPA = [
  ['aaaaa', 'aaafaa'],
  ['aaaaf', 'aaaac'],
  ['ccdcda', 'ddddp'],
  ['ddppd', 'ppppdp'],
  ['pddpp', 'pddd'],
]
const celda = { a: 'ap', f: 'fi', c: 'cu', d: 'av', p: 'pe' }
const mapaHTML = MAPA.map(
  (anio, i) =>
    `<div class="anio"><span>${i + 1}° año</span>` +
    anio.map((fila) => `<div class="fila">${[...fila].map((c) => `<i class="${celda[c]}"></i>`).join('')}</div>`).join('') +
    `</div>`,
).join('')

const ogHTML = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..112,400..800&display=block">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:${PAPER};font-family:Archivo,system-ui,sans-serif;color:${INK};
    padding:60px 76px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:18px}
  .mk{width:72px;height:72px;line-height:0}
  .brand{font-size:36px;font-weight:800;font-stretch:108%;letter-spacing:-0.02em}
  .head{font-size:82px;white-space:nowrap;font-weight:800;font-stretch:108%;line-height:1.02;letter-spacing:-0.03em}
  mark{color:inherit;background:linear-gradient(transparent 0 38%,${RESALTA} 38% 92%,transparent 92%);padding:0 .1em;margin:0 -.1em}
  .sub{font-size:30px;color:${SOFT};margin-top:20px;max-width:880px;line-height:1.3}
  .mapa{display:flex;gap:28px;background:${CARD};border:1.5px solid ${LINE};border-radius:16px;padding:22px 26px;align-self:flex-start}
  .anio{display:flex;flex-direction:column;gap:6px}
  .anio span{font-size:17px;font-weight:600;color:${SOFT};margin-bottom:3px}
  .fila{display:flex;gap:6px}
  .fila i{width:22px;height:22px;border-radius:5px;background:${SUNK}}
  .ap{background:${AP}!important}
  .fi{background:linear-gradient(90deg,${FI} 0 50%,#fdeedf 50% 100%)!important;box-shadow:inset 0 0 0 2px ${FI}}
  .cu{background:radial-gradient(circle,${CU} 0 3.5px,${CU_BG} 4.2px)!important;box-shadow:inset 0 0 0 2px ${CU}}
  .av{background:${RESALTA}!important;box-shadow:inset 0 0 0 1.5px #f2cc1c}
</style></head><body>
  <div class="top">
    <span class="mk">${badge(72)}</span>
    <span class="brand">¿Cuánto me falta?</span>
  </div>
  <div>
    <div class="head">Te faltan <mark>19 materias</mark></div>
    <div class="sub">Marcá tus materias, mirá las correlativas y sabé cuánto te falta para recibirte.</div>
  </div>
  <div class="mapa">${mapaHTML}</div>
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
  // CHROMIUM_PATH: para máquinas donde el navegador ya viene instalado en otro lado
  // y no coincide con la versión que fija @playwright/test (contenedores, CI propio).
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
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
  await page.setContent(ogHTML, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready) // Archivo cargada antes de la foto
  await page.screenshot({ path: join(OUT, 'og.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } })

  await browser.close()
  console.log('✓ Assets generados en public/')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
