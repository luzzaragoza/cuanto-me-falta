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
// La música del final va en compases: el acorde cambia cada COMPAS segundos, y
// los cortes de imagen y las burbujas del cierre caen justo en esos cambios.
export const COMPAS = 2.4
export const REVELACION = 44.8 // "Ya no te falta nada"
export const DUR = REVELACION + 6 * COMPAS + 3.7 // segundos
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

/** La nota con la que se aprueba cada materia. Inventadas, como todo el avance:
 *  buenas en general y más flojas en 3° año, que es el que costó. */
export function notaDe(n, momento) {
  const base = [8, 9, 7, 8, 10, 9, 7, 8, 9, 8]
  return momento === 'm3' || momento === 'm4a' ? [6, 7, 4, 7, 6, 8, 5][n % 7] : base[n % base.length]
}
export const NOTA_ULTIMA = 10 // el Proyecto Final

/** Cuántos cuadros dura cada recorrido por el árbol (se graba uno por cuadro). */
export const CUADROS_NUDO = 54 //  siguiendo la cadena de una materia
export const CUADROS_VERDE = 57 // de 1° a 5° año, con todo aprobado

/** Todos los pasos en orden, numerados desde 1. El paso 0 es el plan vacío. */
export const PASOS = Object.entries(PASOS_POR_MOMENTO).flatMap(([momento, lista]) =>
  lista.map(([cod, estado]) => ({ cod, estado, momento })),
)
PASOS.forEach((p, i) => (p.n = i + 1))

/** Las materias en el orden del plan: el mismo en que la app dibuja el mapa. */
export const MATERIAS = plan.materias.map((m) => ({ cod: m.cod, nom: m.nom }))

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
// Los tiempos están pensados para que cada momento respire: se lee la pregunta,
// se espera la respuesta, y recién ahí se pasa al año siguiente.
const top = (n) => `top-${String(n).padStart(2, '0')}`
const cuadro = (base, i) => `${base}-${String(i).padStart(2, '0')}`
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
  const pintadas = [] // { t, cod, estado }  cada casillero que cambia, para animarlo
  let nota = 0 // cuántas notas de la melodía ya sonaron

  const toma = (t, img) => tomas.push({ t: r3(t), img })
  /** Aplica el paso `n` en el instante `t`: cambia la toma y, si pinta verde, suena. */
  const paso = (t, n, opts = {}) => {
    toma(t, top(n))
    const p = PASOS[n - 1]
    pintadas.push({ t: r3(t), cod: p.cod, estado: p.estado })
    if (p.estado === A) sonido.push({ t: r3(t), tipo: 'nota', n: nota++, ...opts })
    else sonido.push({ t: r3(t), tipo: 'marca' }) // final o cursando: apenas un roce
  }
  const idx = (m) => PASOS.filter((p) => p.momento === m).map((p) => p.n)
  /** Un par de burbujas: la abuela y la respuesta. La etiqueta "Abu" va solo en
   *  la primera: después ya se sabe de quién es la burbuja blanca. */
  const par = (tAbu, tYo, tFin, pregunta, respuesta) => {
    const id = burbujas.length
    burbujas.push({ t0: tAbu, t1: tFin, quien: 'abu', texto: pregunta, par: id, etiqueta: id === 0 })
    burbujas.push({ t0: tYo, t1: tFin, quien: 'yo', texto: respuesta, par: id })
    sonido.push({ t: tAbu, tipo: 'pop_abu' }, { t: tYo, tipo: 'pop_yo' })
  }
  /** Un toque del dedo sobre la pantalla. */
  const toque = (t, id) => {
    toques.push({ t, id })
    sonido.push({ t, tipo: 'toque' })
  }
  /** Un recorrido por el árbol: una captura por cuadro, entre t y t + cuadros/FPS. */
  const recorrido = (t, base, cuadros) => {
    for (let i = 1; i <= cuadros; i++) toma(t + (i - 1) / FPS, cuadro(base, i))
  }
  // Los cambios de plano suenan: aire que pasa.
  const aire = (t, sube = true, fuerza = 1) => sonido.push({ t: r3(t), tipo: 'whoosh', sube, fuerza })

  // Dónde empieza cada parte. La música (sonido.py) se guía por estas marcas.
  const M = { m0: 0, m1: 4.0, m2: 9.0, m3: 14.0, nudo: 21.5, m4: 27.1, m5: 34.6, m6: 41.1 }
  const R = REVELACION
  const B = COMPAS

  // 0 · Marzo de 1° año: el plan vacío.
  fechas.push({ t0: M.m0, t1: M.m1, texto: 'Marzo · 1° año' })
  toma(0, top(0))
  par(0.3, 2.0, 3.8, '¿Y? ¿Cuánto te falta para recibirte?', 'Recién empiezo. Me faltan 52.')
  aire(0.95, false, 0.6)

  // 1 · Diciembre de 1° año: diez casilleros, de a uno.
  fechas.push({ t0: M.m1, t1: M.m2, texto: 'Diciembre · 1° año' })
  aire(M.m1 - 0.1)
  idx('m1').forEach((n, i) => paso(M.m1 + 0.4 + i * 0.24, n))
  par(7.0, 7.8, 8.8, '¿Y, mi amor? ¿Cuánto te falta?', '42. Metí diez este año.')

  // 2 · Diciembre de 2° año: diez más.
  fechas.push({ t0: M.m2, t1: M.m3, texto: 'Diciembre · 2° año' })
  aire(M.m2 - 0.1)
  idx('m2').forEach((n, i) => paso(M.m2 + 0.4 + i * 0.24, n))
  par(12.0, 12.8, 13.8, 'Contame. ¿Cuánto te falta ahora?', '32. Voy bien.')

  // 3 · Diciembre de 3° año: lento. Cinco notas graves con mucho aire entre una
  // y otra. Es el único año en que la abuela no pregunta: se da cuenta sola.
  // Y hace lo que hace una abuela cuando no sabe cómo ayudar: darte de comer.
  fechas.push({ t0: M.m3, t1: M.nudo, texto: 'Diciembre · 3° año' })
  aire(M.m3 - 0.1, false, 1.1)
  titulos.push({ t0: 14.5, t1: 21.3, texto: 'Este año costó.' })
  const t3 = [15.0, 15.8, 16.6, 17.4, 17.85, 18.3, 18.75, 18.75]
  idx('m3').forEach((n, i) => paso(t3[i], n, { grave: true }))
  for (let t = 14.6; t < 19.3; t += 0.5) sonido.push({ t: r3(t), tipo: 'reloj' }) // el reloj
  aire(18.95, true, 0.5)
  par(19.4, 20.3, 21.3, 'Este año no te pregunto. ¿Comiste?', 'Gracias, abu.')

  // El nudo · Febrero: por qué costó. Se abre la materia con el final colgado,
  // se ve lo que traba, y el árbol de correlativas muestra la cadena entera.
  const N = M.nudo
  fechas.push({ t0: N, t1: M.m4, texto: 'Febrero · finales' })
  aire(N - 0.1, false, 0.9)
  toma(N, 'nudo-fila') //            la lista: Probabilidad y Estadística, final pendiente
  toque(N + 0.6, 'corr')
  toma(N + 0.65, 'nudo-corr') //     "Habilita después": tres materias
  titulos.push({ t0: N + 0.9, t1: M.m4 - 0.2, texto: 'Un final trababa tres materias.', chico: true })
  toque(N + 2.2, 'verArbol')
  const arbol = N + 2.32
  toma(arbol, cuadro('arbol', 0)) // el árbol, con la cadena iluminada
  aire(arbol - 0.12, true, 1)
  const recorreNudo = arbol + 0.55
  recorrido(recorreNudo, 'arbol', CUADROS_NUDO)
  // Las tres materias trabadas pasan por la pantalla: tres notas sordas.
  for (let i = 0; i < 3; i++) sonido.push({ t: r3(recorreNudo + 0.45 + i * 0.5), tipo: 'trabada', i })

  // 4 · Diciembre de 4° año: vuelve el ritmo, y llega el primer título.
  fechas.push({ t0: M.m4, t1: M.m5, texto: 'Diciembre · 4° año' })
  aire(M.m4 - 0.1)
  const m4a = idx('m4a')
  m4a.slice(0, 6).forEach((n, i) => paso(M.m4 + 0.4 + i * 0.18, n))
  const analista = M.m4 + 2.4
  aire(analista - 0.8, true, 0.8)
  toma(analista - 0.7, 'analista-antes') // corte a la lista: la banda del título, todavía punteada
  toma(analista, 'analista-despues') // la última de 3° se aprueba y la banda se pone verde
  sonido.push({ t: analista - 0.32, tipo: 'escalera' }, { t: analista, tipo: 'acorde_analista' }, { t: analista, tipo: 'destello' })
  nota++ // esa materia no toca su nota: suena el acorde
  titulos.push({ t0: analista, t1: M.m5 - 0.3, texto: 'El primer título.' })
  const vuelta = analista + 1.5
  aire(vuelta - 0.1, true, 0.8)
  toma(vuelta, top(m4a[6])) // vuelta al mapa: faltan 20
  idx('m4b').forEach((n, i) => paso(vuelta + 0.3 + i * 0.17, n))
  par(M.m4 + 5.6, M.m4 + 6.3, M.m4 + 7.3, '¿Ahora sí puedo preguntar?', '13. Y ya soy analista.')

  // 5 · 5° año: cuenta regresiva. 13, 9, 5, 3, 2, 1, cada vez más seguido, y
  // el 1 se queda un rato largo en pantalla.
  fechas.push({ t0: M.m5, t1: M.m6, texto: '5° año' })
  aire(M.m5 - 0.1, true, 1.1)
  const m5 = idx('m5')
  const rafagas = [
    { en: M.m5 + 1.1, cuantos: 4 }, // 13 → 9
    { en: M.m5 + 2.2, cuantos: 4 }, // 9 → 5
    { en: M.m5 + 3.2, cuantos: 2 }, // 5 → 3
    { en: M.m5 + 4.0, cuantos: 1 }, // 3 → 2
    { en: M.m5 + 4.7, cuantos: 1 }, // 2 → 1
  ]
  numero.push({ t: M.m5 + 0.2, valor: 13 })
  let k = 0
  // Cada ráfaga termina en un golpe: tambor, sacudón y la cámara un paso más cerca.
  const golpes = rafagas.map((r, i) => ({ t: r.en, cae: r3(r.en + (r.cuantos - 1) * (3 / FPS)), i }))
  for (const g of golpes) sonido.push({ t: g.cae, tipo: 'impacto', fuerza: 0.5 + 0.12 * g.i })
  for (const r of rafagas)
    for (let i = 0; i < r.cuantos; i++) {
      const t = r.en + i * (3 / FPS)
      const n = m5[k++]
      paso(t, n, { rapida: true })
      numero.push({ t: r3(t), valor: faltanTras(n) })
    }
  const uno = M.m5 + 4.7

  // 6 · Diciembre de 5° año: la última. Se abre el selector, el dedo duda, toca
  // "Aprobada"… y silencio. Después, la revelación.
  fechas.push({ t0: M.m6, t1: R + B - 0.05, texto: 'Diciembre · 5° año' })
  aire(M.m6 - 0.12, false, 1.2)
  toma(M.m6, 'final-fila') //   la lista, con el Proyecto Final sin marcar
  toque(M.m6 + 0.9, 'fila')
  toma(M.m6 + 0.95, 'final-menu') //  se abre el selector de estado
  const corte = M.m6 + 2.2
  toque(corte, 'aprobada')
  toma(corte + 0.18, 'final-aprobada') // elegida "Aprobada". Pausa.
  sonido.push({ t: corte + 0.12, tipo: 'silencio', hasta: R })
  // El corazón, antes del toque: tres latidos, cada vez más juntos.
  for (const d of [0.3, 1.25, 1.85]) sonido.push({ t: r3(M.m6 + d), tipo: 'latido' })
  // Y después del silencio, medio segundo de aire que se junta antes del golpe.
  sonido.push({ t: R - 0.55, tipo: 'inversa', dur: 0.55 }, { t: R, tipo: 'boom' })
  toma(R, top(PASOS.length + 1)) // corte al inicio: "Ya no te falta nada"

  // La vuelta olímpica: un compás para cada cosa.
  const tIng = R + B //       el título de Ingeniero
  const tVerde = R + 2 * B // el árbol entero, aprobado
  const tNotas = R + 3 * B // las notas y el promedio
  aire(tIng - 0.12, true, 0.9)
  toma(tIng, 'ingeniero')
  fechas.push({ t0: tIng, t1: tVerde - 0.05, texto: 'El título.' })
  aire(tVerde - 0.12, true, 0.9)
  toma(tVerde, cuadro('verde', 0))
  recorrido(tVerde + 0.25, 'verde', CUADROS_VERDE)
  fechas.push({ t0: tVerde, t1: tNotas - 0.05, texto: 'Toda la carrera.' })
  aire(tNotas - 0.12, true, 0.9)
  toma(tNotas, 'notas')
  fechas.push({ t0: tNotas, t1: R + 4 * B - 0.05, texto: 'Y el promedio.' })

  // Lo que no es ni la app ni el texto: luz, color y papel picado.
  const efectos = {
    // Un fogonazo blanco que se apaga.
    destellos: [
      { t: analista, a: 0.3, dur: 0.45 },
      { t: R, a: 0.95, dur: 0.7 },
    ],
    // Sacudones de cámara, en píxeles.
    sacudidas: [...golpes.map((g) => ({ t: g.cae, amp: 4 + 2.2 * g.i })), { t: analista, amp: 5 }, { t: R, amp: 20 }],
    // Bordes oscuros: 0 = nada. Se cierran en el año que costó y antes del final.
    vineta: [[0, 0], [M.m3, 0], [15.5, 0.5], [M.nudo - 0.2, 0.5], [M.nudo + 0.3, 0.22], [M.m4 - 0.3, 0.22], [M.m4 + 0.5, 0], [M.m5, 0], [M.m6, 0.42], [M.m6 + 0.7, 0.62], [R - 0.01, 0.72], [R, 0], [DUR, 0]],
    // Color de la app: 1 = normal. El año que costó se destiñe. Vuelve con el
    // nudo, porque en el árbol el color es el significado (naranja: lo que
    // necesita; verde: lo que habilita).
    saturacion: [[0, 1], [M.m3, 1], [15.8, 0.35], [M.nudo - 0.01, 0.35], [M.nudo, 1], [DUR, 1]],
    confeti: [
      { t: analista + 0.05, tipo: 'chico' },
      { t: R + 0.02, tipo: 'canones' },
      { t: R + 5 * B + 0.1, tipo: 'lluvia' },
    ],
  }

  // 7 · Cierre sobre papel. Cada cosa entra con un cambio de acorde.
  const C0 = R + 4 * B
  aire(C0 - 0.15, false, 0.8)
  const cierre = {
    t0: C0,
    abu: { t: C0 + 0.6, texto: '¿Y? ¿Cuánto te falta?' },
    yo: { t: C0 + B, texto: 'Nada, abu. Me recibí.' },
    abu2: { t: C0 + B + 1.3, texto: 'Yo sabía, mi amor.' }, // la última palabra es de ella
    url: { t: C0 + 2 * B, texto: 'cuantomefalta.app' },
    chico: { t: C0 + 2 * B + 0.5, texto: 'Gratis · sin cuenta · hecha por una estudiante de UADE · no es oficial de UADE' },
  }
  sonido.push({ t: cierre.abu.t, tipo: 'pop_abu' }, { t: cierre.yo.t, tipo: 'pop_yo' }, { t: cierre.abu2.t, tipo: 'pop_abu' })

  // Un cuadro por momento para la hoja de revisión, con el número que tiene
  // que decir el titular de la app en ese instante.
  const hoja = [
    { momento: '0', t: 3.0, faltan: 52 },
    { momento: '1', t: 8.3, faltan: 42 },
    { momento: '2', t: 13.3, faltan: 32 },
    { momento: '3', t: 20.9, faltan: 27 },
    { momento: 'El nudo', t: N + 1.8, faltan: 27, nota: 'lo que traba un final' },
    { momento: 'El nudo', t: M.m4 - 0.4, faltan: 27, nota: 'árbol de correlativas' },
    { momento: '4', t: analista + 0.7, faltan: 20, nota: 'banda de Analista' },
    { momento: '4', t: M.m4 + 6.8, faltan: 13 },
    { momento: '5', t: M.m5 + 2.9, faltan: 5, nota: 'cuenta regresiva' },
    { momento: '5', t: M.m6 - 0.5, faltan: 1 },
    { momento: '6', t: corte - 0.2, faltan: 1, nota: 'se elige "Aprobada"' },
    { momento: '6', t: R + 1.5, faltan: 0 },
    { momento: '6', t: tIng + 1.5, faltan: 0, nota: 'banda de Ingeniero' },
    { momento: '6', t: tVerde + 1.2, faltan: 0, nota: 'el árbol, todo aprobado' },
    { momento: '6', t: tNotas + 1.5, faltan: 0, nota: 'notas y promedio' },
    { momento: '7', t: C0 + B + 0.9, faltan: null },
    { momento: '7', t: DUR - 1.5, faltan: null },
  ]

  tomas.sort((a, b) => a.t - b.t)
  sonido.sort((a, b) => a.t - b.t)
  return {
    fps: FPS,
    dur: DUR,
    notas: nota,
    marcas: { ...M, arbol, recorreNudo, analista, vuelta, uno, corte, revelacion: R, compas: B, golpes, tIng, tVerde, tNotas, cierre: C0 },
    tomas,
    fechas,
    titulos,
    burbujas,
    toques,
    pintadas,
    efectos,
    numero: { puntos: numero, hasta: M.m6 - 0.1 },
    cierre,
    sonido,
    hoja,
  }
}
