// El guion del video "Nada, abu. Me recibí." — la ÚNICA fuente de tiempos.
//
// De acá salen tres cosas, y por eso están sincronizadas sin esfuerzo:
//   · qué captura de la app se ve en cada instante   (capturar.mjs + componer.mjs)
//   · qué fecha, burbuja o texto hay en pantalla      (componer.mjs)
//   · qué suena y cuándo                              (sonido.py, vía guion.json)
//
// Si querés mover un momento, cambiar una frase o reordenar materias, se toca
// SOLO este archivo y se vuelve a correr `node scripts/video/hacer.mjs`.
import { ingInformatica as plan } from '../../src/data/planes/ing-informatica.ts'

export const FPS = 30
export const DUR = 31.5 // segundos. El cierre queda medio segundo más para poder leerlo.
export const PERFIL = 'Juli' // nombre provisorio de la cabecera (pendiente de Luz)

const A = 'aprobada'
const F = 'final'
const C = 'cursando'

// ── El recorrido, materia por materia ───────────────────────────────────────
// Cada paso cambia UNA materia. El orden respeta las correlativas del plan
// (lo comprueba `validar()` más abajo, no hay que creerlo a ojo).
const PASOS_POR_MOMENTO = {
  // 1° año: todo menos Química, el arrastre clásico (no es correlativa de nada).
  m1: ['3.4.069', '3.4.164', '2.1.002', '3.4.043', '3.1.050', '3.4.071', '3.3.121', '3.4.072', '3.1.024', '3.1.051'].map((c) => [c, A]),
  // 2° año completo.
  m2: ['3.4.074', '3.4.207', '3.4.075', '3.1.052', '3.1.053', '3.4.077', '3.4.208', '3.4.078', '3.4.209', '3.1.054'].map((c) => [c, A]),
  // 3° año, el que costó: cinco aprobadas, dos finales colgados, una cursando.
  m3: [
    ['3.4.210', A], // Proceso de Desarrollo de Software
    ['3.4.211', A], // Seminario de Integración Profesional
    ['3.4.212', A], // Teleinformática y Redes
    ['3.4.213', A], // Ingeniería de Datos II
    ['3.1.049', F], // Probabilidad y Estadística → final pendiente
    ['2.4.216', A], // Examen de Inglés
    ['3.1.055', F], // Física II → final pendiente
    ['3.4.215', C], // Teoría de la Computación → cursando
  ],
  // 4° año, primera parte: se cierra todo lo que quedó de 1° a 3° → Analista.
  m4a: ['3.2.178', '3.1.049', '3.1.055', '3.4.215', '3.4.082', '3.4.214', '3.1.056'].map((c) => [c, A]),
  // 4° año, segunda parte: siete de 4°.
  m4b: ['3.4.216', '3.4.089', '3.4.217', '3.4.092', '3.1.025', '3.4.218', '3.4.086'].map((c) => [c, A]),
  // 5° año: lo que queda de 4° y todo 5° menos el Proyecto Final.
  m5: ['OPT1', '3.4.096', '3.4.219', 'PPS06', 'OPT2', '3.4.094', '3.4.220', '3.4.098', 'OPT3', '3.4.221', '3.4.135', '2.3.056'].map((c) => [c, A]),
}
export const ULTIMA = '3.4.100' // Proyecto Final: se aprueba con un toque de verdad
export const BANDA_ANALISTA = 'Analista en Informática'
export const BANDA_INGENIERO = 'Ingeniero en Informática'

/** Todos los pasos en orden, numerados desde 1. El paso 0 es el plan vacío. */
export const PASOS = Object.entries(PASOS_POR_MOMENTO).flatMap(([momento, lista]) =>
  lista.map(([cod, estado]) => ({ cod, estado, momento })),
)
PASOS.forEach((p, i) => (p.n = i + 1))

const TOTAL = plan.materias.length

/** Cuántas faltan (no aprobadas) después de aplicar los primeros `n` pasos. */
export function faltanTras(n) {
  const estados = {}
  for (const p of PASOS.slice(0, n)) estados[p.cod] = p.estado
  return TOTAL - Object.values(estados).filter((e) => e === A).length
}

/** Comprueba el recorrido contra el plan real. Tira un error si algo no cierra. */
export function validar() {
  const cods = new Set(plan.materias.map((m) => m.cod))
  const previas = (cod) => plan.correlativas.filter((c) => c.cod === cod).map((c) => c.requiere)
  const estados = {}
  const aplicar = (cod, estado) => {
    if (!cods.has(cod)) throw new Error(`El código ${cod} no existe en el plan`)
    for (const p of previas(cod)) {
      const e = estados[p] ?? 'pendiente'
      // Misma regla que la app: para aprobar, la previa aprobada; para cursar
      // o deber el final, la previa al menos en curso.
      const ok = estado === A ? e === A : e !== 'pendiente'
      if (!ok) throw new Error(`${cod} pasa a "${estado}" sin su previa ${p} (está "${e}")`)
    }
    estados[cod] = estado
  }
  for (const p of PASOS) aplicar(p.cod, p.estado)
  aplicar(ULTIMA, A)

  const aprobadas = Object.values(estados).filter((e) => e === A).length
  if (aprobadas !== TOTAL || Object.keys(estados).length !== TOTAL)
    throw new Error(`El recorrido aprueba ${aprobadas} de ${TOTAL} materias`)

  // Las cuentas del brief: 52 → 42 → 32 → 27 → 13 → 1 → 0, y Analista con 32.
  const fin = (m) => Math.max(...PASOS.filter((p) => p.momento === m).map((p) => p.n))
  const esperado = { m1: 42, m2: 32, m3: 27, m4a: 20, m4b: 13, m5: 1 }
  for (const [m, n] of Object.entries(esperado))
    if (faltanTras(fin(m)) !== n) throw new Error(`Al final de ${m} faltan ${faltanTras(fin(m))}, no ${n}`)
  const hasta3 = plan.materias.filter((m) => m.anio <= 3).length
  if (hasta3 !== 32) throw new Error(`De 1° a 3° hay ${hasta3} materias, no 32`)
}

// ── La línea de tiempo ──────────────────────────────────────────────────────
const top = (n) => `top-${String(n).padStart(2, '0')}`
const r3 = (x) => Math.round(x * 1000) / 1000

export function construirGuion() {
  validar()
  const tomas = [] //    { t, img }            qué captura de la app se ve desde t
  const sonido = [] //   { t, tipo, ... }
  const burbujas = [] // { t0, t1, quien, texto, par }
  const fechas = []
  const titulos = []
  const toques = [] //   { t, id }  → la posición sale de la captura
  const numero = [] //   { t, valor } el número grande del momento 5
  let nota = 0 // cuántas notas de la melodía ya sonaron

  const toma = (t, img) => tomas.push({ t: r3(t), img })
  /** Aplica el paso `n` en el instante `t`: cambia la toma y, si pinta verde, suena. */
  const paso = (t, n, opts = {}) => {
    toma(t, top(n))
    const p = PASOS[n - 1]
    if (p.estado === A) sonido.push({ t: r3(t), tipo: 'nota', n: nota++, ...opts })
    else sonido.push({ t: r3(t), tipo: 'marca' }) // final o cursando: apenas un roce
  }
  const idx = (m) => PASOS.filter((p) => p.momento === m).map((p) => p.n)
  /** Un par de burbujas: pregunta de la abuela y respuesta. */
  const par = (tAbu, tYo, tFin, pregunta, respuesta) => {
    const id = burbujas.length
    burbujas.push({ t0: tAbu, t1: tFin, quien: 'abu', texto: pregunta, par: id })
    sonido.push({ t: tAbu, tipo: 'pop_abu' })
    if (respuesta) {
      burbujas.push({ t0: tYo, t1: tFin, quien: 'yo', texto: respuesta, par: id })
      sonido.push({ t: tYo, tipo: 'pop_yo' })
    }
  }

  // 0 · Marzo de 1° año: el plan vacío.
  fechas.push({ t0: 0, t1: 2.5, texto: 'Marzo · 1° año' })
  toma(0, top(0))
  par(0.15, 1.2, 2.3, '¿Y? ¿Cuánto te falta para recibirte?', '52, abu.')

  // 1 · Diciembre de 1° año: diez casilleros, de a uno.
  fechas.push({ t0: 2.5, t1: 6.5, texto: 'Diciembre · 1° año' })
  idx('m1').forEach((n, i) => paso(2.8 + i * 0.2, n))
  par(4.85, 5.5, 6.3, '¿Y? ¿Cuánto te falta?', '42.')

  // 2 · Diciembre de 2° año: diez más.
  fechas.push({ t0: 6.5, t1: 10.5, texto: 'Diciembre · 2° año' })
  idx('m2').forEach((n, i) => paso(6.8 + i * 0.2, n))
  par(8.85, 9.5, 10.3, '¿Y?', '32.')

  // 3 · Diciembre de 3° año: lento. Cinco notas graves con aire entre una y otra.
  fechas.push({ t0: 10.5, t1: 15.0, texto: 'Diciembre · 3° año' })
  titulos.push({ t0: 10.8, t1: 14.85, texto: 'Este año costó.' })
  const t3 = [11.0, 11.5, 12.0, 12.5, 12.75, 13.0, 13.25, 13.25]
  idx('m3').forEach((n, i) => paso(t3[i], n, { grave: true }))
  par(13.55, 14.15, 14.85, '¿Y…?', 'No preguntes, abu.')

  // 4 · Diciembre de 4° año: vuelve el ritmo, y llega el primer título.
  fechas.push({ t0: 15.0, t1: 20.0, texto: 'Diciembre · 4° año' })
  const m4a = idx('m4a')
  m4a.slice(0, 6).forEach((n, i) => paso(15.25 + i * 0.13, n))
  toma(16.1, 'analista-antes') // corte a la lista: la banda del título, todavía punteada
  toma(16.45, 'analista-despues') // la última de 3° se aprueba y la banda se pone verde
  sonido.push({ t: 16.45, tipo: 'acorde_analista' })
  nota++ // esa materia no toca su nota: suena el acorde
  titulos.push({ t0: 16.45, t1: 19.85, texto: 'El primer título.' })
  toma(17.3, top(m4a[6])) // vuelta al mapa: faltan 20
  idx('m4b').forEach((n, i) => paso(17.45 + i * 0.13, n))
  par(18.45, 19.0, 19.85, '¿Y?', '13, abu. Y ya soy analista.')

  // 5 · 5° año: cuenta regresiva. 13, 9, 5, 3, 2, 1, cada vez más rápido.
  fechas.push({ t0: 20.0, t1: 24.5, texto: '5° año' })
  const m5 = idx('m5')
  const rafagas = [
    { en: 20.6, cuantos: 4 }, // 13 → 9
    { en: 21.45, cuantos: 4 }, // 9 → 5
    { en: 22.2, cuantos: 2 }, // 5 → 3
    { en: 22.8, cuantos: 1 }, // 3 → 2
    { en: 23.3, cuantos: 1 }, // 2 → 1
  ]
  numero.push({ t: 20.1, valor: 13 })
  let k = 0
  for (const r of rafagas)
    for (let i = 0; i < r.cuantos; i++) {
      const t = r.en + i * (2 / FPS)
      const n = m5[k++]
      paso(t, n, { rapida: true })
      numero.push({ t: r3(t), valor: faltanTras(n) })
    }
  const numeroFin = 24.4

  // 6 · Diciembre de 5° año: la última. Un toque, silencio, y el acorde.
  fechas.push({ t0: 24.5, t1: 27.3, texto: 'Diciembre · 5° año' })
  toma(24.5, 'final-fila') //      la lista, con el Proyecto Final sin marcar
  toques.push({ t: 24.9, id: 'fila' })
  toma(24.95, 'final-menu') //     se abre el selector de estado
  toques.push({ t: 25.5, id: 'aprobada' })
  toma(25.55, 'final-aprobada') // elegida "Aprobada". Pausa.
  sonido.push({ t: 24.9, tipo: 'toque' }, { t: 25.5, tipo: 'toque' })
  sonido.push({ t: 25.62, tipo: 'silencio', hasta: 26.4 })
  toma(26.4, top(PASOS.length + 1)) // corte al inicio: "Ya no te falta nada"
  sonido.push({ t: 26.4, tipo: 'acorde_final', hasta: DUR })
  toma(27.35, 'ingeniero') // y la banda del título
  // Esa banda está al pie de la página: en el celular cae donde TikTok pone su
  // texto. La cámara sube el celular para que se lea (y la fecha le deja el lugar).
  const camara = [{ t0: 27.35, t1: 28.5, dy: -330 }]

  // 7 · Cierre sobre papel.
  const cierre = {
    t0: 28.0,
    abu: { t: 28.25, texto: '¿Y? ¿Cuánto te falta?' },
    yo: { t: 28.95, texto: 'Nada, abu. Me recibí.' },
    url: { t: 29.55, texto: 'cuantomefalta.app' },
    chico: { t: 29.8, texto: 'Gratis · sin cuenta · hecha por una estudiante de UADE · no es oficial de UADE' },
  }
  sonido.push({ t: cierre.abu.t, tipo: 'pop_abu' }, { t: cierre.yo.t, tipo: 'pop_yo' })

  // Un cuadro por momento para la hoja de revisión, con el número que tiene
  // que decir el titular de la app en ese instante.
  const hoja = [
    { momento: 0, t: 1.9, faltan: 52 },
    { momento: 1, t: 6.0, faltan: 42 },
    { momento: 2, t: 10.0, faltan: 32 },
    { momento: 3, t: 14.6, faltan: 27 },
    { momento: 4, t: 16.9, faltan: 20, nota: 'corte a la banda de Analista' },
    { momento: 4, t: 19.5, faltan: 13 },
    { momento: 5, t: 22.0, faltan: 5, nota: 'cuenta regresiva' },
    { momento: 5, t: 24.2, faltan: 1 },
    { momento: 6, t: 25.3, faltan: 1, nota: 'se elige "Aprobada"' },
    { momento: 6, t: 27.0, faltan: 0 },
    { momento: 6, t: 27.8, faltan: 0, nota: 'banda de Ingeniero' },
    { momento: 7, t: 31.0, faltan: null },
  ]

  tomas.sort((a, b) => a.t - b.t)
  sonido.sort((a, b) => a.t - b.t)
  return {
    fps: FPS,
    dur: DUR,
    notas: nota,
    tomas,
    fechas,
    titulos,
    burbujas,
    toques,
    camara,
    numero: { puntos: numero, hasta: numeroFin },
    cierre,
    sonido,
    hoja,
  }
}
