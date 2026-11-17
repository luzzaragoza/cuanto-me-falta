// La hoja de revisión: un cuadro de cada momento, con las franjas donde TikTok
// pone su interfaz marcadas encima, y el número que tiene que decir el titular.
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { abrirComposicion } from './componer.mjs'
import { SALIDA, TMP, CHROMIUM } from './rutas.mjs'

// Guía aproximada del brief: 12 % arriba, 22 % abajo, 12 % a la derecha.
const ZONAS = { arriba: 12, abajo: 22, derecha: 12 }

export async function hoja() {
  const dir = join(TMP, 'hoja')
  mkdirSync(dir, { recursive: true })
  const { g, cuadro, cerrar } = await abrirComposicion()
  const cap = JSON.parse(readFileSync(join(TMP, 'capturas.json'), 'utf8'))
  const titularDe = Object.fromEntries(cap.verificacion.map((v) => [v.toma, v.titular]))
  const celdas = []
  for (const [i, h] of g.hoja.entries()) {
    const c = await cuadro(h.t)
    const archivo = join(dir, `${String(i).padStart(2, '0')}.png`)
    writeFileSync(archivo, await c.png())
    // Qué toma de la app se ve en ese instante, y qué decía su titular al grabarla.
    const toma = g.tomas.filter((x) => x.t <= h.t).at(-1).img
    celdas.push({ ...h, src: pathToFileURL(archivo).href, titular: titularDe[toma] ?? null })
  }
  await cerrar()

  const mm = (t) => t.toFixed(1).replace('.', ',')
  const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..112,400..800&display=block">
<style>
  body { margin: 0; padding: 48px 48px 40px; width: 2400px; background: #fff; color: #151b33; font-family: Archivo, sans-serif; }
  h1 { margin: 0 0 6px; font-size: 44px; font-weight: 800; font-stretch: 108%; letter-spacing: -0.02em; }
  p { margin: 0 0 30px; font-size: 22px; color: #5b6173; }
  p i { display: inline-block; width: 22px; height: 22px; vertical-align: -4px; margin-right: 6px; background: rgba(217, 99, 15, 0.22); border: 2px dashed #d9630f; }
  .grilla { display: grid; grid-template-columns: repeat(6, 1fr); gap: 34px 24px; }
  figure { margin: 0; }
  .cuadro { position: relative; aspect-ratio: 9 / 16; border: 2px solid #e3e1da; overflow: hidden; }
  .cuadro img { display: block; width: 100%; height: 100%; }
  .z { position: absolute; background: rgba(217, 99, 15, 0.16); border: 0 dashed #d9630f; }
  .z.ar { inset: 0 0 auto 0; height: ${ZONAS.arriba}%; border-bottom-width: 2px; }
  .z.ab { inset: auto 0 0 0; height: ${ZONAS.abajo}%; border-top-width: 2px; }
  .z.de { inset: ${ZONAS.arriba}% 0 ${ZONAS.abajo}% auto; width: ${ZONAS.derecha}%; border-left-width: 2px; }
  figcaption { margin-top: 12px; font-size: 21px; line-height: 1.35; }
  figcaption b { font-weight: 800; }
  figcaption span { color: #5b6173; }
  .ok { color: #0f5236; font-weight: 700; }
</style>
<h1>Nada, abu. Me recibí. · hoja de revisión</h1>
<p><i></i>Franjas donde TikTok pone su interfaz (guía aproximada: 12 % arriba, 22 % abajo, 12 % a la derecha). Ahí no tiene que caer ningún texto importante.</p>
<div class="grilla">
${celdas
  .map(
    (c) => `<figure>
  <div class="cuadro"><img src="${c.src}"><div class="z ar"></div><div class="z ab"></div><div class="z de"></div></div>
  <figcaption><b>${/^\d/.test(c.momento) ? 'Momento ' + c.momento : c.momento}</b> <span>· ${mm(c.t)} s${c.nota ? ' · ' + c.nota : ''}</span><br>
  ${c.faltan == null ? 'Cierre' : c.titular ? `Titular: «${c.titular}» <span class="ok">✓ faltan ${c.faltan}</span>` : `Faltan ${c.faltan} <span>(otra pantalla de la app)</span>`}</figcaption>
</figure>`,
  )
  .join('\n')}
</div>`
  const pagina = join(dir, 'hoja.html')
  writeFileSync(pagina, html)
  const browser = await chromium.launch({ executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined })
  const page = await browser.newPage({ viewport: { width: 2496, height: 1200 } })
  await page.goto(pathToFileURL(pagina).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  mkdirSync(SALIDA, { recursive: true })
  const destino = join(SALIDA, 'hoja-de-revision.png')
  await page.screenshot({ path: destino, fullPage: true })
  await browser.close()
  console.log(`✓ hoja de revisión → ${destino}`)
  return destino
}

if (import.meta.url === `file://${process.argv[1]}`) await hoja()
