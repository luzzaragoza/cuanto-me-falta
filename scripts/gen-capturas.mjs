// Genera las capturas del README (docs/captura-app.png y docs/captura-arbol.png)
// contra la app REAL, con un avance de ejemplo sembrado en localStorage.
// Correr con: node scripts/gen-capturas.mjs   (regenera las dos en docs/)
//
// Levanta un servidor de Vite propio (no hace falta tener `npm run dev` abierto) y
// lo cierra al terminar. Salen a 2× (retina) del encuadre histórico (1240×730 y
// 1240×820), que en el README se muestran a 820px de ancho: nítidas y con la misma
// proporción de siempre. OJO: nada de `fullPage` — el plan completo mide 5 años y
// daría una tira altísima e ilegible al escalarla.
//
// Cuándo correrlo: cuando la UI cambie lo suficiente como para que las capturas
// mientan (features nuevas visibles, rediseños). El avance de ejemplo de abajo es
// inventado a propósito — es una demo, no el progreso real de nadie.
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs')
const PORT = 5199 // propio, para no chocar con un `npm run dev` abierto

// Materia del árbol: tiene cadena para los dos lados (necesita Programación I →
// Fundamentos; habilita Proceso de Desarrollo y Aplicaciones Interactivas, que a
// su vez habilitan las dos Desarrollo de Aplicaciones). Muestra violeta Y teal.
const FOCO = '3.4.074' // Programación II

// Avance de ejemplo: alumna promediando 3° año de Ing. en Informática (Plan 1621).
// Respeta las correlativas del plan (nada marcado sin sus previas), así la demo es
// verosímil: 1° completo, 2° casi completo con un final pendiente, 3° en curso.
const APROBADAS = {
  // 1° año
  '3.4.069': 8, // Fundamentos de Informática
  '3.4.164': 9, // Sistemas de Información I
  '2.1.002': 7, // Pensamiento Crítico y Comunicación
  '3.4.043': 8, // Teoría de Sistemas
  '3.1.050': 6, // Elementos de Álgebra y Geometría
  '3.4.071': 9, // Programación I
  '3.3.121': 7, // Sistemas de Representación
  '3.4.072': 8, // Arquitectura de Computadores
  '3.1.024': 7, // Matemática Discreta
  '3.1.051': 7, // Álgebra
  // 2° año
  '3.4.074': 10, // Programación II
  '3.4.207': 8, // Sistemas de Información II
  '3.4.075': 7, // Sistemas Operativos
  '3.1.052': 6, // Física I
  '3.4.077': 9, // Programación III
  '3.4.208': 9, // Paradigma Orientado a Objetos
  '3.4.078': 7, // Fundamentos de Telecomunicaciones
  '3.4.209': 8, // Ingeniería de Datos I
  // 3° año
  '2.4.216': 9, // Examen de Inglés
}
// Cursada aprobada, falta rendir. Química es el clásico arrastre de 1° año (no es
// correlativa de nada, así que colgarla no vuelve inconsistente al resto).
const FINAL = ['3.1.053', '3.2.178'] // Cálculo I · Fundamentos de Química
const CURSANDO = [
  '3.1.054', // Cálculo II (Cálculo I está en final = al menos en curso ✓)
  '3.4.210', // Proceso de Desarrollo de Software
  '3.4.211', // Seminario de Integración Profesional
  '3.4.213', // Ingeniería de Datos II
]

const seed = { APROBADAS, FINAL, CURSANDO }

// Corre en el navegador ANTES de que cargue la app: deja el localStorage listo.
// Se descartan los banners (sync/iOS) y el tour: en una captura son ruido.
function sembrar({ APROBADAS, FINAL, CURSANDO }) {
  const states = {}
  const notas = {}
  for (const [cod, nota] of Object.entries(APROBADAS)) {
    states[cod] = 'aprobada'
    notas[cod] = nota
  }
  for (const cod of FINAL) states[cod] = 'final'
  for (const cod of CURSANDO) states[cod] = 'cursando'

  localStorage.setItem(
    'plan-uade-v3',
    JSON.stringify({ states, notas, optNames: {}, custom: [], profile: { name: 'Ana', photo: '' } }),
  )
  localStorage.setItem('cmf-plan-activo', 'uade-ing-informatica')
  localStorage.setItem('cmf-tour-visto', '1')
  localStorage.setItem('cmf-aviso-sync', '1')
  localStorage.setItem('cmf-aviso-ios', '1')
}

const run = async () => {
  mkdirSync(OUT, { recursive: true })

  const server = await createServer({ root: ROOT, server: { port: PORT, strictPort: true } })
  await server.listen()
  const url = `http://localhost:${PORT}/`

  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1240, height: 730 },
    deviceScaleFactor: 2, // retina: se ve nítido escalado a 820px en el README
  })
  await page.addInitScript(sembrar, seed)

  // ── 1. Pantalla principal (arriba: avance + tarjetas + arranque del plan) ──
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.locator('.hero').waitFor()
  await page.locator('.counts').waitFor()
  await page.screenshot({ path: join(OUT, 'captura-app.png') })
  console.log('✓ docs/captura-app.png')

  // ── 2. Árbol en MODO RAMA (árbol v2, ADR-10): abrir con foco entra directo en
  // la rama de la materia, ya encuadrada por fitView — sin zoom ni paneo manual.
  // Camino real del usuario: fila de la materia → "Ver correlativas" → "Ver árbol".
  await page.locator(`[id="mat-${FOCO}"] > .corr-btn`).click()
  await page.locator('.corr').waitFor()
  await page.locator('.corr-tree').click()
  await page.locator('.react-flow').waitFor()
  await page.setViewportSize({ width: 1240, height: 660 })
  await page.locator('.tv-canvas.rama').waitFor() // la rama se juntó
  await page.waitForTimeout(1600) // viaje de tarjetas + fitView + fade de flechas/rótulos
  await page.screenshot({ path: join(OUT, 'captura-arbol.png') })
  console.log('✓ docs/captura-arbol.png')

  await browser.close()
  await server.close()
}

run().catch(async (e) => {
  console.error(e)
  process.exit(1)
})
