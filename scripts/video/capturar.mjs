// Graba la app REAL, cuadro por cuadro: una captura por cada estado del recorrido.
//
// Levanta su propio Vite, abre la app en formato celular (390×844 a 2×) con el
// plan vacío sembrado en localStorage, y después cambia el estado de a UNA
// materia por el store de la app (el mismo que usa la interfaz). La última, el
// Proyecto Final, se aprueba tocando la fila y eligiendo "Aprobada" de verdad.
//
// En cada paso lee el titular (`.hero-tit`) y lo compara con lo que dice el
// guion: si la app no muestra el número esperado, corta ahí.
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PASOS, ULTIMA, PERFIL, BANDA_ANALISTA, BANDA_INGENIERO, faltanTras } from './guion.mjs'
import { ROOT, TMP, CHROMIUM } from './rutas.mjs'

const PORT = 5198
const OUT = join(TMP, 'app')

function sembrar(nombre) {
  localStorage.setItem(
    'plan-uade-v3',
    JSON.stringify({ states: {}, notas: {}, optNames: {}, custom: [], profile: { name: nombre, photo: '' } }),
  )
  localStorage.setItem('cmf-plan-activo', 'uade-ing-informatica')
  for (const k of ['cmf-tour-visto', 'cmf-aviso-sync', 'cmf-aviso-ios']) localStorage.setItem(k, '1')
}

export async function capturar() {
  mkdirSync(OUT, { recursive: true })
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, strictPort: true } })
  await server.listen()
  const browser = await chromium.launch({ executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  await page.addInitScript(sembrar, PERFIL)
  // Sin backend: así no aparece el aviso de "hay una versión nueva" en la toma.
  await page.route('**/rest/v1/**', (r) => r.abort())
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' })
  await page.locator('.hero-tit').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)

  const verificacion = []
  const foto = async (nombre) => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.screenshot({ path: join(OUT, `${nombre}.png`), animations: 'disabled' })
  }
  const titular = () => page.locator('.hero-tit').innerText().then((s) => s.replace(/\s+/g, ' ').trim())
  const esperado = (faltan) =>
    faltan === 0 ? 'Ya no te falta nada' : faltan === 1 ? 'Te falta 1 materia' : `Te faltan ${faltan} materias`
  const comprobar = async (toma, faltan) => {
    const dice = await titular()
    const ok = dice === esperado(faltan)
    verificacion.push({ toma, faltan, titular: dice, ok })
    if (!ok) throw new Error(`${toma}: la app dice "${dice}" y el guion espera "${esperado(faltan)}"`)
  }
  const set = (cod, estado) =>
    page.evaluate(
      async ([c, e]) => (await import('/src/state/store.ts')).store.setEstado(c, e),
      [cod, estado],
    )
  const arriba = () => page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  /** Deja el elemento a `y` píxeles del borde de arriba del celular. */
  const llevarA = (loc, y) =>
    loc.evaluate((el, yy) => {
      const top = el.getBoundingClientRect().top + window.scrollY - yy
      window.scrollTo({ top, behavior: 'instant' })
    }, y)
  const centro = async (loc) => {
    const b = await loc.boundingBox()
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }
  }
  const banda = (nombre) => page.locator('.titulo-hito', { hasText: nombre })
  const top = (n) => `top-${String(n).padStart(2, '0')}`

  // Paso 0: el plan vacío.
  await comprobar(top(0), 52)
  await foto(top(0))

  for (const p of PASOS) {
    // La materia que completa 1° a 3° se aprueba mirando la lista: ahí está la
    // banda del título de Analista, que pasa de punteada a verde.
    const cierraAnalista = faltanTras(p.n) === 20 && faltanTras(p.n - 1) === 21
    if (cierraAnalista) {
      await llevarA(banda(BANDA_ANALISTA), 330)
      await foto('analista-antes')
      await set(p.cod, p.estado)
      await foto('analista-despues')
      if (!(await banda(BANDA_ANALISTA).evaluate((el) => el.classList.contains('ok'))))
        throw new Error('La banda de Analista no quedó como obtenida')
      await arriba()
    } else {
      await set(p.cod, p.estado)
    }
    await comprobar(top(p.n), faltanTras(p.n))
    await foto(top(p.n))
  }

  // La última: Proyecto Final, con dos toques de verdad.
  const toques = {}
  const fila = page.locator(`[id="mat-${ULTIMA}"]`)
  await llevarA(fila, 150)
  await foto('final-fila')
  toques.fila = await centro(fila)
  await fila.tap()
  const aprobada = page.locator('.spop .sp-opt', { hasText: 'Aprobada' })
  await aprobada.waitFor()
  await page.waitForTimeout(350) // que termine de abrirse el selector
  await foto('final-menu')
  toques.aprobada = await centro(aprobada)
  await aprobada.tap()
  await page.locator('.spop').waitFor({ state: 'detached' })
  await page.waitForTimeout(350)
  await foto('final-aprobada')

  await arriba()
  await comprobar(top(PASOS.length + 1), 0)
  await foto(top(PASOS.length + 1))

  await llevarA(banda(BANDA_INGENIERO), 330)
  if (!(await banda(BANDA_INGENIERO).evaluate((el) => el.classList.contains('ok'))))
    throw new Error('La banda de Ingeniero no quedó como obtenida')
  await foto('ingeniero')

  await browser.close()
  await server.close()
  writeFileSync(join(TMP, 'capturas.json'), JSON.stringify({ toques, verificacion }, null, 1))
  console.log(`✓ ${verificacion.length} titulares comprobados contra el guion`)
  return { toques, verificacion }
}

if (import.meta.url === `file://${process.argv[1]}`) await capturar()
