// Arma los cuadros del video: la captura de la app en un celular, más la fecha,
// las burbujas y los textos, sobre un lienzo de 1080×1920.
//
// La composición es una página (componer.html) con una función `render(t)` que
// dibuja el instante t. Acá se la recorre cuadro por cuadro, se le saca una
// captura a cada uno y se le pasan a ffmpeg. Los cuadros repetidos (cuando no
// se mueve nada) no se vuelven a capturar.
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { construirGuion } from './guion.mjs'
import { construirCamara, ESCALA } from './camara.mjs'
import { AQUI, ROOT, TMP, CHROMIUM } from './rutas.mjs'

/** El guion, completado con lo que solo se sabe después de grabar la app. */
export function guionCompleto() {
  const g = construirGuion()
  const cap = JSON.parse(readFileSync(join(TMP, 'capturas.json'), 'utf8'))
  g.toques = g.toques.map((q) => ({ ...q, ...cap.toques[q.id] }))
  g.cajas = cap.cajas
  g.escala = ESCALA
  g.camara = construirCamara(g, cap.cajas)
  g.base = pathToFileURL(join(TMP, 'app')).href
  // El "¿" de la marca: el mismo trazo que usa la app, leído de su componente.
  g.trazo = readFileSync(join(ROOT, 'src/components/Logo.tsx'), 'utf8').match(/TRAZO_PREGUNTA =\s*'([^']+)'/)[1]
  return g
}

export async function abrirComposicion(g = guionCompleto()) {
  const browser = await chromium.launch({ executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined })
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('composición:', e.message))
  await page.goto(pathToFileURL(join(AQUI, 'componer.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate((guion) => init(guion), g)
  const cuadro = async (t) => {
    const firma = await page.evaluate((tt) => render(tt), t)
    return { firma, png: () => page.screenshot({ type: 'png' }) }
  }
  return { g, page, cuadro, cerrar: () => browser.close() }
}

/** Renderiza todos los cuadros a un MP4 sin sonido. */
export async function componer() {
  mkdirSync(TMP, { recursive: true })
  const { g, cuadro, cerrar } = await abrirComposicion()
  const total = Math.round(g.dur * g.fps)
  const salida = join(TMP, 'imagen.mp4')
  const ff = spawn(
    'ffmpeg',
    [
      '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(g.fps), '-c:v', 'png', '-i', '-',
      // Colores declarados (BT.709): si no, cada reproductor adivina y el papel vira.
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-r', String(g.fps),
      salida,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  let previa = null
  let buf = null
  let distintos = 0
  for (let f = 0; f < total; f++) {
    const c = await cuadro(f / g.fps)
    if (c.firma !== previa) {
      buf = await c.png()
      previa = c.firma
      distintos++
    }
    if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain')
  }
  ff.stdin.end()
  const [code] = await once(ff, 'close')
  await cerrar()
  if (code !== 0) throw new Error(`ffmpeg terminó con código ${code}`)
  console.log(`✓ ${total} cuadros (${distintos} distintos) → ${salida}`)
  writeFileSync(join(TMP, 'guion.json'), JSON.stringify(g, null, 1))
  return salida
}

if (import.meta.url === `file://${process.argv[1]}`) await componer()
