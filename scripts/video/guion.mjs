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
export const REVELACION = 67.4 // "Ya no te falta nada"
export const DUR = REVELACION + 9 * COMPAS + 3.9 // segundos
export const PERFIL = 'Juli' // nombre provisorio de la cabecera (pendiente de Luz)

const A = 'aprobada'
const F = 'final'
const C = 'cursando'

// ── El recorrido, materia por materia ───────────────────────────────────────
// Cada paso cambia UNA materia. Cada año tiene dos tiempos, como en la vida:
// en marzo las materias pasan a "cursando" (violeta) y en diciembre se aprueban
// (verde). El orden respeta las correlativas del plan: lo comprueba `validar()`.
const de = (anio) => plan.materias.filter((m) => m.anio === anio).map((m) => m.cod)
const sin = (lista, ...fuera) => lista.filter((c) => !fuera.includes(c))
const QUIMICA = '3.2.178' // el arrastre clásico de 1° (no es correlativa de nada)
const PROBA = '3.1.049' //   Probabilidad y Estadística: el final que traba todo
export const ULTIMA = '3.4.100' // Proyecto Final: se aprueba con un toque de verdad

const TERCERO_CURSA = ['3.4.210', '3.4.211', '3.4.212', '3.4.213', PROBA, '3.4.215']
const CIERRAN_TERCERO = ['3.1.055', '3.4.215', '3.4.082', '3.4.214', '3.1.056'] // lo que faltaba de 3°
const CUARTO = ['3.4.216', '3.4.089', '3.4.217', '3.4.092', '3.1.025', '3.4.218', '3.4.086']
const QUINTO = ['OPT1', '3.4.096', '3.4.219', 'PPS06', 'OPT2', '3.4.094', '3.4.220', '3.4.098', 'OPT3', '3.4.221', '3.4.135', '2.3.056']

const PASOS_POR_MOMENTO = {
  // 1° año. En marzo, las once a cursar; en diciembre, diez aprobadas y Química
  // con el final pendiente (naranja), que se arrastra hasta 4°.
  m1a: de(1).map((c) => [c, C]),
  m1b: [...sin(de(1), QUIMICA).map((c) => [c, A]), [QUIMICA, F]],
  // 2° año completo.
  m2a: de(2).map((c) => [c, C]),
  m2b: de(2).map((c) => [c, A]),
  // 3° año, el que costó: se anota en seis y aprueba cinco (el Examen de Inglés
  // se rinde, no se cursa). Probabilidad queda con el final pendiente y Teoría
  // de la Computación sigue cursándose.
  m3a: TERCERO_CURSA.map((c) => [c, C]),
  m3b: [['3.4.210', A], ['3.4.211', A], ['3.4.212', A], ['3.4.213', A], [PROBA, F], ['2.4.216', A]],
  // Febrero: los dos finales colgados.
  feb: [[QUIMICA, A], [PROBA, A]],
  // 4° año. En marzo, lo que faltaba de 3° más siete de 4°; en diciembre se
  // cierra 3° (→ Analista) y después esas siete.
  m4a: [...sin(CIERRAN_TERCERO, '3.4.215'), ...CUARTO].map((c) => [c, C]),
  m4b: CIERRAN_TERCERO.map((c) => [c, A]),
  m4c: CUARTO.map((c) => [c, A]),
  // 5° año: se cursa todo lo que queda, y se aprueba todo menos el Proyecto Final.
  m5a: [...QUINTO.slice(0, 7), ULTIMA, ...QUINTO.slice(7)].map((c) => [c, C]),
  m5b: QUINTO.map((c) => [c, A]),
}
export const BANDA_ANALISTA = 'Analista en Informática'
export const BANDA_INGENIERO = 'Ingeniero en Informática'

/** Las materias en el orden del plan: el mismo en que la app dibuja el mapa. */
export const MATERIAS = plan.materias.map((m) => ({ cod: m.cod, nom: m.nom }))

/** La nota con la que se aprueba cada materia. Inventadas, como todo el avance:
 *  buenas en general y más flojas en 3° año, que es el que costó. */
export function notaDe(n, momento) {
  const base = [8, 9, 7, 8, 10, 9, 7, 8, 9, 8]
  return ['m3b', 'feb', 'm4b'].includes(momento) ? [6, 7, 4, 7, 6, 8, 5][n % 7] : base[n % base.length]
}
export const NOTA_ULTIMA = 10 // el Proyecto Final

/** Cuántos cuadros dura cada recorrido de pantalla (se graba uno por cuadro). */
export const CUADROS = {
  lista: 48, //  la lista de 3° año, bajando hasta la materia trabada
  arbol: 78, //  el árbol, siguiendo la cadena de una materia
  verde: 117, // el árbol de 1° a 5° año, con todo aprobado
  notas: 66, //  las notas, bajando por la lista
}

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
  if (estados[ULTIMA] !== C) throw new Error('El Proyecto Final tiene que llegar al final como "cursando"')
  aplicar(ULTIMA, A)

  const aprobadas = Object.values(estados).filter((e) => e === A).length
  if (aprobadas !== TOTAL || Object.keys(estados).length !== TOTAL)
    throw new Error(`El recorrido aprueba ${aprobadas} de ${TOTAL} materias`)

  // Las cuentas del brief: 52 → 42 → 32 → 27 → 13 → 1 → 0, y Analista con 32.
  const fin = (m) => Math.max(...PASOS.filter((p) => p.momento === m).map((p) => p.n))
  const esperado = { m1b: 42, m2b: 32, m3b: 27, feb: 25, m4b: 20, m4c: 13, m5b: 1 }
  for (const [m, n] of Object.entries(esperado))
    if (faltanTras(fin(m)) !== n) throw new Error(`Al final de ${m} faltan ${faltanTras(fin(m))}, no ${n}`)
  const hasta3 = plan.materias.filter((m) => m.anio <= 3).length
  if (hasta3 !== 32) throw new Error(`De 1° a 3° hay ${hasta3} materias, no 32`)
}

// ── La línea de tiempo ──────────────────────────────────────────────────────
// Los tiempos están pensados para que cada cosa se vea bien: se lee la
// pregunta, se espera la respuesta, y recién ahí se pasa a lo siguiente.
const top = (n) => `top-${String(n).padStart(3, '0')}`
const cuadro = (base, i) => `${base}-${String(i).padStart(3, '0')}`
const r3 = (x) => Math.round(x * 1000) / 1000

export function construirGuion() {
  validar()
  const tomas = [] //    { t, img }            qué captura de la app se ve desde t
  const sonido = [] //   { t, tipo, ... }
  const burbujas = [] // { t0, t1, quien, texto, par }
  const fechas = []
  const titulos = []
  const toques = [] //   { t, id }  → la posición sale de la captura
  const numero = [] //   { t, valor } el número grande de la cuenta regresiva
  const pintadas = [] // { t, cod, estado }  cada casillero que cambia, para animarlo
  let nota = 0 // cuántas notas de la melodía ya sonaron

  const toma = (t, img) => tomas.push({ t: r3(t), img })
  /** Aplica el paso `n` en el instante `t`: cambia la toma y suena según el estado. */
  const paso = (t, n, opts = {}) => {
    toma(t, top(n))
    const p = PASOS[n - 1]
    pintadas.push({ t: r3(t), cod: p.cod, estado: p.estado })
    if (p.estado === A) sonido.push({ t: r3(t), tipo: 'nota', n: nota++, ...opts })
    else if (p.estado === C) sonido.push({ t: r3(t), tipo: 'cursa', i: opts.i ?? 0 }) // violeta: un punteo suave
    else sonido.push({ t: r3(t), tipo: 'marca' }) // final pendiente: apenas un roce
  }
  const idx = (m) => PASOS.filter((p) => p.momento === m).map((p) => p.n)
  /** Varios pasos seguidos, uno cada `cada` segundos. Devuelve cuándo termina. */
  const tanda = (t, momento, cada, opts) => {
    const ns = idx(momento)
    ns.forEach((n, i) => paso(t + i * cada, n, { ...opts, i }))
    return t + (ns.length - 1) * cada
  }
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
  /** Un recorrido de pantalla: una captura por cuadro, desde t. Devuelve cuándo termina. */
  const recorrido = (t, base) => {
    for (let i = 1; i <= CUADROS[base]; i++) toma(t + (i - 1) / FPS, cuadro(base, i))
    return t + CUADROS[base] / FPS
  }
  // Los cambios de plano suenan: aire que pasa.
  const aire = (t, sube = true, fuerza = 1) => sonido.push({ t: r3(t), tipo: 'whoosh', sube, fuerza })
  const fecha = (t0, t1, texto) => fechas.push({ t0, t1, texto })

  const R = REVELACION
  const B = COMPAS
  // Dónde empieza cada parte. La cámara y la música se guían por estas marcas.
  const M = {
    m1: 4.5, dic1: 6.6, m2: 12.8, dic2: 14.8, m3: 20.8, dic3: 22.8,
    nudo: 31.2, feb: 41.2, m4: 43.0, dic4: 45.0, m5: 54.0, cuenta: 56.2, m6: 63.2,
  }

  // 0 · Marzo de 1° año: el plan vacío, y la pregunta.
  fecha(0, M.dic1, 'Marzo · 1° año')
  toma(0, top(0))
  par(0.3, 2.0, 4.2, '¿Y? ¿Cuánto te falta para recibirte?', 'Recién empiezo. Me faltan 52.')
  aire(0.95, false, 0.6)

  // 1 · 1° año. Marzo: se anota en todo (violeta). Diciembre: diez aprobadas.
  aire(M.m1 - 0.1)
  tanda(M.m1 + 0.6, 'm1a', 0.11)
  fecha(M.dic1, M.m2, 'Diciembre · 1° año')
  aire(M.dic1 - 0.1, true, 0.7)
  tanda(M.dic1 + 0.4, 'm1b', 0.26)
  par(10.3, 11.2, 12.5, '¿Y, mi amor? ¿Cuánto te falta?', '42. Metí diez este año.')

  // 2 · 2° año, igual: violeta en marzo, verde en diciembre.
  fecha(M.m2, M.dic2, 'Marzo · 2° año')
  aire(M.m2 - 0.1)
  tanda(M.m2 + 0.4, 'm2a', 0.11)
  fecha(M.dic2, M.m3, 'Diciembre · 2° año')
  aire(M.dic2 - 0.1, true, 0.7)
  tanda(M.dic2 + 0.4, 'm2b', 0.26)
  par(18.2, 19.1, 20.5, 'Contame. ¿Cuánto te falta ahora?', '32. Voy bien.')

  // 3 · 3° año. No hay frase: el tiempo se frena solo. Menos materias, cada
  // nota tarda en llegar, y el reloj se oye. Es el único año en que la abuela
  // no pregunta: se da cuenta sola, y hace lo que hace una abuela: darte de comer.
  fecha(M.m3, M.dic3, 'Marzo · 3° año')
  aire(M.m3 - 0.1, false, 1.0)
  tanda(M.m3 + 0.5, 'm3a', 0.17)
  fecha(M.dic3, M.nudo, 'Diciembre · 3° año')
  const t3 = [23.5, 24.4, 25.3, 26.2, 26.9, 27.6]
  idx('m3b').forEach((n, i) => paso(t3[i], n, { grave: true }))
  // El reloj: cada tic llega un poco más tarde que el anterior.
  for (let t = M.dic3 + 0.3, cada = 0.5; t < 28.0; t += cada, cada += 0.045) sonido.push({ t: r3(t), tipo: 'reloj' })
  aire(27.95, true, 0.5)
  par(28.4, 29.5, 30.9, 'Este año no te pregunto. ¿Comiste?', 'Gracias, abu.')

  // El nudo · Febrero. Mira qué puede hacer: en la lista se ve lo que cursa
  // (violeta), el final que debe (naranja) y lo que ya está disponible
  // (amarillo). Abre el final colgado, ve lo que traba, y el árbol de
  // correlativas le muestra la cadena entera.
  const N = M.nudo
  fecha(N, M.m4, 'Febrero · finales')
  aire(N - 0.1, false, 0.9)
  toma(N, cuadro('lista', 0)) //        la lista de 3° año
  const finLista = recorrido(N + 0.5, 'lista') // baja hasta Probabilidad y Estadística
  toque(N + 3.1, 'corr')
  toma(N + 3.15, 'nudo-corr') //        "Habilita después": tres materias
  titulos.push({ t0: N + 3.5, t1: M.feb - 0.2, texto: 'Un final trababa tres materias.', chico: true })
  toque(N + 5.3, 'verArbol')
  const arbol = N + 5.42
  toma(arbol, cuadro('arbol', 0)) //    el árbol, con la cadena iluminada
  aire(arbol - 0.12, true, 1)
  const recorreNudo = arbol + 0.9
  const finArbol = recorrido(recorreNudo, 'arbol')
  // Las tres materias trabadas pasan por la pantalla: tres notas sordas.
  for (let i = 0; i < 3; i++) sonido.push({ t: r3(recorreNudo + 0.6 + i * 0.75), tipo: 'trabada', i })
  // Y rinde: los dos finales colgados se ponen verdes.
  aire(M.feb - 0.1, true, 0.9)
  toma(M.feb, top(idx('m3b').at(-1)))
  tanda(M.feb + 0.5, 'feb', 0.65)

  // 4 · 4° año: vuelve el ritmo, y llega el primer título.
  fecha(M.m4, M.dic4, 'Marzo · 4° año')
  aire(M.m4 - 0.1)
  tanda(M.m4 + 0.4, 'm4a', 0.1)
  fecha(M.dic4, M.m5, 'Diciembre · 4° año')
  aire(M.dic4 - 0.1, true, 0.7)
  const m4b = idx('m4b')
  m4b.slice(0, 4).forEach((n, i) => paso(M.dic4 + 0.4 + i * 0.22, n))
  const analista = M.dic4 + 2.4
  aire(analista - 0.9, true, 0.8)
  toma(analista - 0.8, 'analista-antes') // corte a la lista: la banda del título, todavía punteada
  toma(analista, 'analista-despues') // la última de 3° se aprueba y la banda se pone verde
  sonido.push({ t: analista - 0.32, tipo: 'escalera' }, { t: analista, tipo: 'acorde_analista' }, { t: analista, tipo: 'destello' })
  nota++ // esa materia no toca su nota: suena el acorde
  titulos.push({ t0: analista, t1: M.m5 - 0.3, texto: 'El primer título.' })
  const vuelta = analista + 1.9
  aire(vuelta - 0.1, true, 0.8)
  toma(vuelta, top(m4b[4])) // vuelta al mapa: faltan 20
  tanda(vuelta + 0.3, 'm4c', 0.2)
  par(51.4, 52.2, 53.7, '¿Ahora sí puedo preguntar?', '13. Y ya soy analista.')

  // 5 · 5° año. Marzo: se anota en todo lo que queda. Después, la cuenta
  // regresiva: 13, 9, 5, 3, 2, 1, cada vez más seguido, y el 1 se queda un
  // rato largo en pantalla. La única violeta que queda es el Proyecto Final.
  fecha(M.m5, M.cuenta, 'Marzo · 5° año')
  aire(M.m5 - 0.1)
  tanda(M.m5 + 0.4, 'm5a', 0.1)
  fecha(M.cuenta, M.m6, '5° año')
  aire(M.cuenta - 0.1, true, 1.1)
  const m5 = idx('m5b')
  const rafagas = [
    { en: M.cuenta + 1.1, cuantos: 4 }, // 13 → 9
    { en: M.cuenta + 2.3, cuantos: 4 }, // 9 → 5
    { en: M.cuenta + 3.4, cuantos: 2 }, // 5 → 3
    { en: M.cuenta + 4.3, cuantos: 1 }, // 3 → 2
    { en: M.cuenta + 5.1, cuantos: 1 }, // 2 → 1
  ]
  numero.push({ t: M.cuenta + 0.2, valor: 13 })
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
  const uno = M.cuenta + 5.1

  // 6 · Diciembre de 5° año: la última, que venía cursando. Se abre el
  // selector, el dedo duda, toca "Aprobada"… y silencio. Después, la revelación.
  fecha(M.m6, R + 2 * B - 0.05, 'Diciembre · 5° año')
  aire(M.m6 - 0.12, false, 1.2)
  toma(M.m6, 'final-fila') //   la lista, con el Proyecto Final en violeta
  toque(M.m6 + 1.1, 'fila')
  toma(M.m6 + 1.15, 'final-menu') //  se abre el selector: está en "Cursando"
  const corte = M.m6 + 2.7
  toque(corte, 'aprobada')
  toma(corte + 0.18, 'final-aprobada') // elegida "Aprobada". Pausa.
  sonido.push({ t: corte + 0.12, tipo: 'silencio', hasta: R })
  // El corazón, antes del toque: cuatro latidos, cada vez más juntos.
  for (const d of [0.3, 1.25, 1.95, 2.4]) sonido.push({ t: r3(M.m6 + d), tipo: 'latido' })
  // Y después del silencio, medio segundo de aire que se junta antes del golpe.
  sonido.push({ t: R - 0.55, tipo: 'inversa', dur: 0.55 }, { t: R, tipo: 'boom' })
  toma(R, top(PASOS.length + 1)) // corte al inicio: "Ya no te falta nada"

  // La vuelta olímpica. La música va en compases y cada cosa entra con uno.
  const tIng = R + 2 * B //   el título de Ingeniero            (1 compás)
  const tVerde = R + 3 * B // el árbol entero, aprobado         (2 compases)
  const tNotas = R + 5 * B // las notas y el promedio           (2 compases)
  const C0 = R + 7 * B //     el cierre                         (3 compases)
  aire(tIng - 0.12, true, 0.9)
  toma(tIng, 'ingeniero')
  fecha(tIng, tVerde - 0.05, 'El título.')
  aire(tVerde - 0.12, true, 0.9)
  toma(tVerde, cuadro('verde', 0))
  recorrido(tVerde + 0.4, 'verde')
  fecha(tVerde, tNotas - 0.05, 'Toda la carrera.')
  aire(tNotas - 0.12, true, 0.9)
  toma(tNotas, cuadro('notas', 0))
  const bajaNotas = tNotas + 1.9
  recorrido(bajaNotas, 'notas')
  fecha(tNotas, C0 - 0.05, 'Y el promedio.')

  // Lo que no es ni la app ni el texto: luz, color y papel picado.
  const efectos = {
    // Un fogonazo blanco que se apaga.
    destellos: [
      { t: analista, a: 0.3, dur: 0.45 },
      { t: R, a: 0.95, dur: 0.7 },
    ],
    // Sacudones de cámara, en píxeles.
    sacudidas: [...golpes.map((g) => ({ t: g.cae, amp: 4 + 2.2 * g.i })), { t: analista, amp: 5 }, { t: R, amp: 20 }],
    // Bordes oscuros: 0 = nada. Se cierran un poco en 3° año y antes del final.
    vineta: [[0, 0], [M.dic3, 0], [M.dic3 + 1.5, 0.38], [M.nudo - 0.2, 0.38], [M.nudo + 0.3, 0.2], [M.feb - 0.2, 0.2], [M.feb + 0.3, 0], [M.cuenta, 0], [M.m6, 0.42], [M.m6 + 0.7, 0.62], [R - 0.01, 0.72], [R, 0], [DUR, 0]],
    // Color de la app: 1 = normal. En diciembre de 3° año se destiñe. Vuelve
    // en febrero, porque en la lista y en el árbol el color es el significado.
    saturacion: [[0, 1], [M.dic3, 1], [M.dic3 + 1.8, 0.45], [M.nudo - 0.01, 0.45], [M.nudo, 1], [DUR, 1]],
    confeti: [
      { t: analista + 0.05, tipo: 'chico' },
      { t: R + 0.02, tipo: 'canones' },
      { t: C0 + B + 0.1, tipo: 'lluvia' },
    ],
  }

  // 7 · Cierre sobre papel. Cada cosa entra con un cambio de acorde.
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
    { momento: '0', t: 3.4, faltan: 52 },
    { momento: '1', t: M.dic1 - 0.4, faltan: 52, nota: 'marzo: cursando' },
    { momento: '1', t: 12.0, faltan: 42 },
    { momento: '2', t: 20.0, faltan: 32 },
    { momento: '3', t: M.dic3 - 0.3, faltan: 32, nota: 'marzo: cursando' },
    { momento: '3', t: 30.3, faltan: 27 },
    { momento: 'El nudo', t: finLista + 0.6, faltan: 27, nota: 'qué puede hacer' },
    { momento: 'El nudo', t: N + 4.6, faltan: 27, nota: 'lo que traba un final' },
    { momento: 'El nudo', t: finArbol + 1.0, faltan: 27, nota: 'árbol de correlativas' },
    { momento: 'El nudo', t: M.m4 - 0.2, faltan: 25, nota: 'los finales, rendidos' },
    { momento: '4', t: analista + 0.9, faltan: 20, nota: 'banda de Analista' },
    { momento: '4', t: 53.0, faltan: 13 },
    { momento: '5', t: M.cuenta - 0.3, faltan: 13, nota: 'marzo: cursando' },
    { momento: '5', t: M.m6 - 0.5, faltan: 1 },
    { momento: '6', t: corte - 0.3, faltan: 1, nota: 'de "Cursando" a "Aprobada"' },
    { momento: '6', t: R + 2.5, faltan: 0 },
    { momento: '6', t: tIng + 1.5, faltan: 0, nota: 'banda de Ingeniero' },
    { momento: '6', t: tVerde + 2.4, faltan: 0, nota: 'el árbol, todo aprobado' },
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
    marcas: {
      ...M, finLista, arbol, recorreNudo, finArbol, analista, vuelta, uno, corte,
      revelacion: R, compas: B, golpes, tIng, tVerde, tNotas, bajaNotas, cierre: C0,
    },
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
