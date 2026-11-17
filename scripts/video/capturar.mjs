// Graba la app REAL, cuadro por cuadro: una captura por cada estado del recorrido.
//
// Levanta su propio Vite, abre la app en formato celular (390×844 a 3×, para
// que los acercamientos de cámara no se pixelen) con el
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
import {
  PASOS, MATERIAS, ULTIMA, PERFIL, BANDA_ANALISTA, BANDA_INGENIERO, faltanTras,
  notaDe, NOTA_ULTIMA, CUADROS_NUDO, CUADROS_VERDE,
} from './guion.mjs'
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
    deviceScaleFactor: 3,
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
  // Dónde está cada cosa en la pantalla (en píxeles del celular): la cámara y
  // las animaciones del video apuntan a estas cajas.
  const caja = async (loc) => {
    const b = await loc.boundingBox()
    return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }
  }
  const cajas = { mapaEn: {} }
  const toques = {} // dónde cae cada toque del dedo
  const foto = async (nombre) => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.screenshot({ path: join(OUT, `${nombre}.png`), animations: 'disabled' })
    // El mapa puede correrse unos píxeles si cambia el renglón de arriba: se anota en cada toma.
    if (nombre.startsWith('top-')) cajas.mapaEn[nombre] = await caja(page.locator('.mapa'))
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
  /** Cambia el estado de una materia por el store de la app; si se aprueba, con su nota. */
  const set = (cod, estado, nota = null) =>
    page.evaluate(
      async ([c, e, n]) => {
        const { store } = await import('/src/state/store.ts')
        if (e) store.setEstado(c, e)
        if (n != null) store.setNota(c, n)
      },
      [cod, estado, nota],
    )
  const pad = (i) => String(i).padStart(2, '0')
  const suave = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
  /** Recorre el árbol hacia la derecha, de verdad: mueve el scroll un poquito y
   *  saca una foto, tantas veces como cuadros dure el recorrido en el video. */
  const recorrer = async (base, cuadros, hasta) => {
    const lienzo = page.locator('.tv-lienzo')
    const desde = await lienzo.evaluate((l) => l.scrollLeft)
    const tope = await lienzo.evaluate((l) => l.scrollWidth - l.clientWidth)
    const fin = Math.min(tope, hasta ?? tope)
    for (let i = 1; i <= cuadros; i++) {
      const x = desde + (fin - desde) * suave(i / cuadros)
      await lienzo.evaluate((l, left) => l.scrollTo({ left, behavior: 'instant' }), x)
      await foto(`${base}-${pad(i)}`)
    }
    return fin - desde
  }
  const cerrarArbol = async () => {
    await page.locator('.tv-volver').tap()
    await page.locator('.treeview').waitFor({ state: 'detached' })
  }

  /** El nudo: la materia con el final colgado, lo que traba, y su cadena en el árbol.
   *  Es el camino real de la app: fila → "Ver correlativas" → "ver árbol". */
  const nudo = async () => {
    const fila = page.locator('[id="mat-3.1.049"]') // Probabilidad y Estadística
    await llevarA(fila, 245)
    cajas.nudoFila = await caja(fila)
    await foto('nudo-fila')
    const boton = fila.locator('.corr-btn')
    toques.corr = await centro(boton)
    await boton.tap()
    const panel = page.locator('.corr')
    await panel.waitFor()
    await page.waitForTimeout(350)
    cajas.nudoPanel = await caja(panel)
    await foto('nudo-corr')
    const ver = page.locator('.corr-tree')
    toques.verArbol = await centro(ver)
    await ver.tap()
    await page.locator('.tv-nodo.sel').waitFor()
    await page.waitForTimeout(1300) // que el árbol termine de acomodarse sobre la materia
    cajas.arbolFoco = await caja(page.locator('.tv-nodo.sel'))
    cajas.arbolFicha = await caja(page.locator('.tv-ficha'))
    // Entre qué alturas está la cadena: la cámara encuadra eso y la ficha de abajo.
    const cadena = ['Cálculo I', 'Probabilidad y Estadística', 'Estadística Avanzada', 'Ciencia de Datos', 'Evaluación de Proyectos Informáticos']
    const alturas = []
    for (const nom of cadena) alturas.push(await caja(page.locator('.tv-nodo', { hasText: new RegExp(`^${nom}$`) })))
    cajas.arbolCadena = { y0: Math.min(...alturas.map((c) => c.y)), y1: Math.max(...alturas.map((c) => c.y + c.h)) }
    await foto('arbol-00')
    // Hasta que la última de la cadena (Evaluación de Proyectos) quede bien adentro.
    const ultima = alturas.at(-1)
    const scroll = await page.locator('.tv-lienzo').evaluate((l) => l.scrollLeft)
    await recorrer('arbol', CUADROS_NUDO, scroll + ultima.x + ultima.w - 390 + 60)
    await cerrarArbol()
    await boton.tap() // se cierra el panel de correlativas
    await panel.waitFor({ state: 'detached' })
    await arriba()
  }
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
  cajas.titular = await caja(page.locator('.hero-tit'))
  cajas.tablero = await caja(page.locator('.hero'))
  cajas.mapa = cajas.mapaEn[top(0)]
  // Un casillero por materia, en el orden del plan. Se guarda relativo al mapa.
  const celdas = await page.$$eval('.mapa-fila i', (els) =>
    els.map((e) => ({ nom: e.title, ...e.getBoundingClientRect().toJSON() })),
  )
  if (celdas.length !== MATERIAS.length) throw new Error(`El mapa tiene ${celdas.length} casilleros, no ${MATERIAS.length}`)
  cajas.celdas = {}
  celdas.forEach((c, i) => {
    if (c.nom !== MATERIAS[i].nom) throw new Error(`Casillero ${i}: "${c.nom}" no es "${MATERIAS[i].nom}"`)
    cajas.celdas[MATERIAS[i].cod] = { x: +(c.x - cajas.mapa.x).toFixed(1), y: +(c.y - cajas.mapa.y).toFixed(1), w: c.width, h: c.height }
  })

  for (const p of PASOS) {
    // La materia que completa 1° a 3° se aprueba mirando la lista: ahí está la
    // banda del título de Analista, que pasa de punteada a verde.
    const cierraAnalista = faltanTras(p.n) === 20 && faltanTras(p.n - 1) === 21
    if (cierraAnalista) {
      await llevarA(banda(BANDA_ANALISTA), 330)
      cajas.analista = await caja(banda(BANDA_ANALISTA))
      await foto('analista-antes')
      await set(p.cod, p.estado)
      await foto('analista-despues')
      if (!(await banda(BANDA_ANALISTA).evaluate((el) => el.classList.contains('ok'))))
        throw new Error('La banda de Analista no quedó como obtenida')
      await arriba()
    } else {
      await set(p.cod, p.estado)
    }
    if (p.estado === 'aprobada') await set(p.cod, null, notaDe(p.n, p.momento))
    await comprobar(top(p.n), faltanTras(p.n))
    await foto(top(p.n))
    // Terminado 3° año, antes de seguir: el nudo.
    if (p.momento === 'm3' && PASOS[p.n]?.momento !== 'm3') await nudo()
  }

  // La última: Proyecto Final, con dos toques de verdad.
  const fila = page.locator(`[id="mat-${ULTIMA}"]`)
  await llevarA(fila, 150)
  await foto('final-fila')
  toques.fila = await centro(fila)
  cajas.fila = await caja(fila)
  await fila.tap()
  const aprobada = page.locator('.spop .sp-opt', { hasText: 'Aprobada' })
  await aprobada.waitFor()
  await page.waitForTimeout(350) // que termine de abrirse el selector
  await foto('final-menu')
  toques.aprobada = await centro(aprobada)
  cajas.menu = await caja(page.locator('.spop'))
  await aprobada.tap()
  await page.locator('.spop').waitFor({ state: 'detached' })
  await page.waitForTimeout(350)
  await foto('final-aprobada')
  await set(ULTIMA, null, NOTA_ULTIMA)

  await arriba()
  await comprobar(top(PASOS.length + 1), 0)
  await foto(top(PASOS.length + 1))

  await llevarA(banda(BANDA_INGENIERO), 330)
  if (!(await banda(BANDA_INGENIERO).evaluate((el) => el.classList.contains('ok'))))
    throw new Error('La banda de Ingeniero no quedó como obtenida')
  cajas.ingeniero = await caja(banda(BANDA_INGENIERO))
  await foto('ingeniero')

  // El árbol entero, con todo aprobado: se aleja dos pasos (55 %) y se recorre
  // de 1° a 5° año.
  await arriba()
  await page.locator('.nav-tile').first().tap()
  await page.locator('.treeview').waitFor()
  await page.waitForTimeout(900)
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Alejar' }).tap()
    await page.waitForTimeout(450)
  }
  const nodos = await page.$$eval('.tv-nodo', (els) => els.map((e) => e.getBoundingClientRect().toJSON()))
  cajas.verde = { y0: Math.min(...nodos.map((n) => n.top)), y1: Math.max(...nodos.map((n) => n.bottom)) }
  await foto('verde-00')
  await recorrer('verde', CUADROS_VERDE)
  await cerrarArbol()

  // Las notas y el promedio.
  await page.locator('.nav-tile').nth(1).tap()
  await page.locator('.drawer-prom').waitFor()
  await page.waitForTimeout(900)
  cajas.promedio = await caja(page.locator('.drawer-prom'))
  verificacion.push({ toma: 'notas', promedio: (await page.locator('.np-num').innerText()).trim() })
  await foto('notas')

  await browser.close()
  await server.close()
  writeFileSync(join(TMP, 'capturas.json'), JSON.stringify({ toques, cajas, verificacion }, null, 1))
  console.log(`✓ ${verificacion.filter((v) => v.titular).length} titulares comprobados contra el guion · promedio ${verificacion.at(-1).promedio}`)
  return { toques, cajas, verificacion }
}

if (import.meta.url === `file://${process.argv[1]}`) await capturar()
