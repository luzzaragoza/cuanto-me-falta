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
// Todo el video va sobre una grilla musical: 100 pulsos por minuto, cuatro
// tiempos por compás. Los cortes, las burbujas y cada materia que se pinta caen
// en un tiempo o en una fracción exacta, así la imagen y la música van juntas.
export const COMPAS = 2.4 // segundos (cuatro tiempos de 0,6)
/** El instante en que empieza un compás (y, si se pide, uno de sus cuatro tiempos). */
export const T = (compas, tiempo = 0) => Math.round((compas * COMPAS + tiempo * (COMPAS / 4)) * 1000) / 1000
export const REVELACION = T(32) // "Ya no te falta nada"
export const DUR = T(46) // segundos
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
const SEMI = COMPAS / 16 // una semicorchea: 0,15 s
const CORCHEA = COMPAS / 8 // 0,3 s

export function construirGuion() {
  validar()
  const tomas = [] //    { t, img }            qué captura de la app se ve desde t
  const sonido = [] //   { t, tipo, ... }
  const burbujas = [] // { t0, t1, quien, texto, par }
  const fechas = []
  const titulos = []
  const toques = [] //   { t, id }  → la posición sale de la captura
  const numero = [] //   { t, valor } el número grande de la cuenta regresiva
  const pintadas = [] // { t, cod, estado }  cada casillero que cambia, para marcarlo
  let nota = 0 // cuántas notas de la melodía ya sonaron

  const toma = (t, img) => tomas.push({ t: r3(t), img })
  /** Aplica el paso `n` en el instante `t`: cambia la toma y suena según el estado. */
  const paso = (t, n, opts = {}) => {
    toma(t, top(n))
    const p = PASOS[n - 1]
    pintadas.push({ t: r3(t), cod: p.cod, estado: p.estado })
    if (p.estado === A) sonido.push({ t: r3(t), tipo: 'nota', n: nota++, ...opts })
    else if (p.estado === C) sonido.push({ t: r3(t), tipo: 'cursa', i: opts.i ?? 0 })
    else sonido.push({ t: r3(t), tipo: 'marca' }) // final pendiente: apenas un roce
  }
  const idx = (m) => PASOS.filter((p) => p.momento === m).map((p) => p.n)
  /** Varios pasos seguidos, uno cada `cada` segundos. */
  const tanda = (t, momento, cada, opts) => idx(momento).forEach((n, i) => paso(t + i * cada, n, { ...opts, i }))
  /** Un intercambio: la abuela pregunta, le contestan, y ella anota. La
   *  etiqueta "Abu" va solo en la primera burbuja del video. */
  const charla = (tAbu, tYo, tAnota, tFin, pregunta, respuesta, anota) => {
    const id = burbujas.length
    burbujas.push({ t0: tAbu, t1: tFin, quien: 'abu', texto: pregunta, par: id, etiqueta: id === 0 })
    burbujas.push({ t0: tYo, t1: tFin, quien: 'yo', texto: respuesta, par: id })
    burbujas.push({ t0: tAnota, t1: tFin, quien: 'abu', texto: anota, par: id })
    sonido.push({ t: tAbu, tipo: 'pop_abu' }, { t: tYo, tipo: 'pop_yo' }, { t: tAnota, tipo: 'pop_abu' })
    sonido.push({ t: r3(tAnota + 0.25), tipo: 'lapiz' }) // se la oye anotar
  }
  /** Un toque del dedo sobre la pantalla. */
  const toque = (t, id) => {
    toques.push({ t, id })
    sonido.push({ t, tipo: 'toque' })
  }
  /** Un recorrido de pantalla: una captura por cuadro, desde t. Devuelve cuándo termina. */
  const recorrido = (t, base) => {
    for (let i = 1; i <= CUADROS[base]; i++) toma(t + (i - 1) / FPS, cuadro(base, i))
    return r3(t + CUADROS[base] / FPS)
  }
  const corteDePlano = (t) => sonido.push({ t: r3(t - 0.1), tipo: 'whoosh' })
  const fecha = (t0, t1, texto) => fechas.push({ t0, t1, texto })

  const R = REVELACION
  // Dónde empieza cada parte, en compases. La cámara y la música se guían por esto.
  const M = {
    m1: T(2), dic1: T(3), m2: T(6), dic2: T(7), m3: T(10), dic3: T(11),
    nudo: T(15), feb: T(19), m4: T(20), dic4: T(21), m5: T(26), cuenta: T(27), m6: T(30),
  }

  // 0 · Marzo de 1° año: el plan vacío, y la pregunta. Ella anota: se oye el lápiz.
  fecha(0, M.dic1, 'Marzo · 1° año')
  toma(0, top(0))
  charla(0.3, T(0, 3), T(1, 1.5), M.m1 - 0.2, '¿Cuánto te falta para recibirte?', 'Empecé hoy, abu. 52 materias.', '52. Anotado.')

  // 1 · 1° año. Marzo: se anota en todo (violeta). Diciembre: diez aprobadas.
  tanda(M.m1 + 0.3, 'm1a', SEMI)
  fecha(M.dic1, M.m2, 'Diciembre · 1° año')
  tanda(M.dic1 + 0.3, 'm1b', CORCHEA)
  charla(T(4, 2.5), T(5, 0.5), T(5, 2.5), M.m2 - 0.2, '¿Y ahora cuánto te falta?', '42.', '42. Anotado.')

  // 2 · 2° año, igual: violeta en marzo, verde en diciembre.
  fecha(M.m2, M.dic2, 'Marzo · 2° año')
  tanda(M.m2 + 0.3, 'm2a', SEMI)
  fecha(M.dic2, M.m3, 'Diciembre · 2° año')
  tanda(M.dic2 + 0.3, 'm2b', CORCHEA)
  charla(T(8, 2), T(9), T(9, 2), M.m3 - 0.2, '¿Y ahora?', '32. Voy bien.', 'Anotado.')

  // 3 · 3° año. No hay frase: el tiempo se frena solo. Menos materias, cada
  // nota tarda en llegar, y el reloj se oye. La abuela no insiste con el
  // número: anota otra cosa.
  fecha(M.m3, M.dic3, 'Marzo · 3° año')
  tanda(M.m3 + 0.3, 'm3a', CORCHEA)
  fecha(M.dic3, M.nudo, 'Diciembre · 3° año')
  const t3 = [T(11, 1), T(11, 3), T(12, 1), T(12, 3), T(13), T(13, 1)]
  idx('m3b').forEach((n, i) => paso(t3[i], n, { grave: true }))
  // El reloj: un tic por tiempo, y después cada vez más espaciados.
  for (const t of [T(11), T(11, 1), T(11, 2), T(11, 3), T(12), T(12, 1.5), T(12, 3), T(13, 1), T(13, 3)]) sonido.push({ t, tipo: 'reloj' })
  charla(T(13, 2), T(14), T(14, 2), M.nudo - 0.2, '¿Y este año?', 'Mejor no preguntes.', 'Entonces anoto que venís a comer.')

  // El nudo · Febrero. Mira qué puede hacer: en la lista se ve lo que cursa
  // (violeta), el final que debe (naranja) y lo que ya está disponible
  // (amarillo). Abre el final colgado, ve lo que traba, y el árbol de
  // correlativas le muestra la cadena entera.
  const N = M.nudo
  fecha(N, M.m4, 'Febrero · finales')
  corteDePlano(N)
  toma(N, cuadro('lista', 0)) //        la lista de 3° año
  const finLista = recorrido(N + 0.3, 'lista') // baja hasta Probabilidad y Estadística
  toque(T(16), 'corr')
  toma(T(16) + 0.05, 'nudo-corr') //    "Habilita después": tres materias
  titulos.push({ t0: T(16) + 0.4, t1: M.feb - 0.2, texto: 'Un final trababa tres materias.', chico: true })
  toque(T(17) - 0.15, 'verArbol')
  const arbol = T(17)
  toma(arbol, cuadro('arbol', 0)) //    el árbol, con la cadena iluminada
  corteDePlano(arbol)
  const recorreNudo = arbol + 0.6
  const finArbol = recorrido(recorreNudo, 'arbol')
  // Las tres materias trabadas pasan por la pantalla: tres notas sordas.
  for (let i = 0; i < 3; i++) sonido.push({ t: r3(recorreNudo + 0.6 + i * 0.75), tipo: 'trabada', i })
  // Y rinde: los dos finales colgados se ponen verdes.
  corteDePlano(M.feb)
  toma(M.feb, top(idx('m3b').at(-1)))
  tanda(M.feb + 0.6, 'feb', 0.6)

  // 4 · 4° año: vuelve el ritmo, y llega el primer título.
  fecha(M.m4, M.dic4, 'Marzo · 4° año')
  tanda(M.m4 + 0.3, 'm4a', SEMI)
  fecha(M.dic4, M.m5, 'Diciembre · 4° año')
  const m4b = idx('m4b')
  m4b.slice(0, 4).forEach((n, i) => paso(M.dic4 + 0.3 + i * CORCHEA, n))
  const analista = T(22)
  toma(analista - 0.6, 'analista-antes') // corte a la lista: la banda del título, todavía punteada
  toma(analista, 'analista-despues') // la última de 3° se aprueba y la banda se pone verde
  sonido.push({ t: analista, tipo: 'titulo' })
  nota++ // esa materia no toca su nota: suena el acorde
  titulos.push({ t0: analista, t1: M.m5 - 0.3, texto: 'El primer título.' })
  const vuelta = T(23)
  toma(vuelta, top(m4b[4])) // vuelta al mapa: faltan 20
  tanda(vuelta + 0.3, 'm4c', CORCHEA)
  charla(T(24, 0.5), T(24, 2.5), T(25, 0.5), M.m5 - 0.3, '¿Ahora sí puedo preguntar?', '13. Y ya soy analista.', 'Anotado. Las dos cosas.')

  // 5 · 5° año. Marzo: se anota en todo lo que queda. Después, la cuenta
  // regresiva: 13, 9, 5, 3, 2, 1, cada vez más seguido, y el 1 se queda un
  // rato largo en pantalla. La única violeta que queda es el Proyecto Final.
  fecha(M.m5, M.cuenta, 'Marzo · 5° año')
  tanda(M.m5 + 0.3, 'm5a', SEMI)
  fecha(M.cuenta, M.m6, '5° año')
  const m5 = idx('m5b')
  const rafagas = [
    { en: T(27, 1.5), cuantos: 4 }, // 13 → 9
    { en: T(27, 3.5), cuantos: 4 }, // 9 → 5
    { en: T(28, 1.5), cuantos: 2 }, // 5 → 3
    { en: T(28, 3), cuantos: 1 }, //   3 → 2
    { en: T(29), cuantos: 1 }, //      2 → 1
  ]
  numero.push({ t: M.cuenta + 0.2, valor: 13 })
  let k = 0
  // Cada ráfaga termina en un golpe: un tambor, y la cámara un paso más cerca.
  const golpes = rafagas.map((r, i) => ({ t: r.en, cae: r3(r.en + (r.cuantos - 1) * SEMI), i }))
  for (const g of golpes) sonido.push({ t: g.cae, tipo: 'impacto', fuerza: 0.5 + 0.12 * g.i })
  for (const r of rafagas)
    for (let i = 0; i < r.cuantos; i++) {
      const t = r.en + i * SEMI
      const n = m5[k++]
      paso(t, n, { rapida: true })
      numero.push({ t: r3(t), valor: faltanTras(n) })
    }
  const uno = T(29)

  // 6 · Diciembre de 5° año: la última, que venía cursando. Se abre el
  // selector, el dedo duda, toca "Aprobada"… y silencio. Después, la revelación.
  fecha(M.m6, T(34) - 0.05, 'Diciembre · 5° año')
  corteDePlano(M.m6)
  toma(M.m6, 'final-fila') //   la lista, con el Proyecto Final en violeta
  toque(T(30, 2), 'fila')
  toma(T(30, 2) + 0.05, 'final-menu') //  se abre el selector: está en "Cursando"
  const corte = T(31, 1)
  toque(corte, 'aprobada')
  toma(corte + 0.18, 'final-aprobada') // elegida "Aprobada". Pausa.
  sonido.push({ t: corte + 0.12, tipo: 'silencio', hasta: R })
  // El corazón, antes del toque: cuatro latidos, cada vez más juntos.
  for (const t of [T(30, 0.5), T(30, 2.5), T(30, 3.75), T(31, 0.5)]) sonido.push({ t, tipo: 'latido' })
  // Y después del silencio, medio segundo de aire que se junta antes del golpe.
  sonido.push({ t: R - 0.55, tipo: 'inversa', dur: 0.55 }, { t: R, tipo: 'boom' })
  toma(R, top(PASOS.length + 1)) // corte al inicio: "Ya no te falta nada"

  // La vuelta: un plano por cosa, cada uno en su compás.
  const tIng = T(34) //   el título de Ingeniero       (1 compás)
  const tVerde = T(35) // el árbol entero, aprobado    (2 compases)
  const tNotas = T(37) // las notas y el promedio      (2 compases)
  const C0 = T(39) //     el final con la abuela
  corteDePlano(tIng)
  toma(tIng, 'ingeniero')
  fecha(tIng, tVerde - 0.05, 'El título.')
  corteDePlano(tVerde)
  toma(tVerde, cuadro('verde', 0))
  recorrido(tVerde + 0.4, 'verde')
  fecha(tVerde, tNotas - 0.05, 'Toda la carrera.')
  corteDePlano(tNotas)
  toma(tNotas, cuadro('notas', 0))
  const bajaNotas = tNotas + 1.9
  recorrido(bajaNotas, 'notas')
  fecha(tNotas, C0 - 0.05, 'Y el promedio.')

  // Luz y color: lo mínimo. Un fogonazo y papel picado, una sola vez, en la
  // revelación; y la app desteñida mientras 3° año no avanza.
  const efectos = {
    destellos: [{ t: R, a: 0.9, dur: 0.6 }],
    saturacion: [[0, 1], [M.dic3, 1], [M.dic3 + 1.8, 0.45], [M.nudo - 0.01, 0.45], [M.nudo, 1], [DUR, 1]],
    confeti: [{ t: R + 0.02, tipo: 'canones' }],
  }

  // 7 · El final. Sobre papel, la última vez que pregunta. Y la respuesta de
  // ella no es un mensaje: es una foto de su libreta. Todos los números que le
  // fueron diciendo, tachados uno por uno, y el cero con un círculo.
  const cierre = {
    t0: C0,
    abu: { t: C0 + 0.5, texto: '¿Y? ¿Cuánto te falta?' },
    yo: { t: T(40), texto: 'Nada, abu. Me recibí.' },
    escribe: T(40, 1.5), //  ella empieza a contestar… y tarda
    foto: T(41) - 0.2, //    llega una foto
    abre: T(41, 2), //       la foto se abre: es su libreta
    circulo: T(42, 1), //    el círculo alrededor del cero
    firma: T(42, 3), //      "Yo sabía."
    libreta: {
      titulo: `Lo que le falta a ${PERFIL}`,
      renglones: [
        { cuando: 'empezó', valor: '52', tachado: true },
        { cuando: '1° año', valor: '42', tachado: true },
        { cuando: '2° año', valor: '32', tachado: true },
        { cuando: '3° año', valor: 'vino a comer', texto: true },
        { cuando: '4° año', valor: '13', tachado: true, extra: '¡analista!' },
        { cuando: '5° año', valor: '0', cero: true },
      ],
      firma: 'Yo sabía.',
    },
    tarjeta: T(44), //       la invitación
    llamado: 'Anotalo vos también.',
    url: 'cuantomefalta.app',
    chico: 'Gratis · sin cuenta · hecha por una estudiante de UADE · no es oficial de UADE',
  }
  sonido.push({ t: cierre.abu.t, tipo: 'pop_abu' }, { t: cierre.yo.t, tipo: 'pop_yo' }, { t: cierre.foto, tipo: 'pop_abu' })
  sonido.push({ t: cierre.circulo, tipo: 'lapiz', largo: true }, { t: cierre.firma, tipo: 'lapiz' })

  // Un cuadro por momento para la hoja de revisión, con el número que tiene
  // que decir el titular de la app en ese instante.
  const hoja = [
    { momento: '0', t: T(1, 3), faltan: 52 },
    { momento: '1', t: M.dic1 - 0.4, faltan: 52, nota: 'marzo: cursando' },
    { momento: '1', t: T(5, 3.4), faltan: 42 },
    { momento: '2', t: T(9, 3.4), faltan: 32 },
    { momento: '3', t: M.dic3 - 0.3, faltan: 32, nota: 'marzo: cursando' },
    { momento: '3', t: T(14, 3.4), faltan: 27 },
    { momento: 'El nudo', t: finLista + 0.3, faltan: 27, nota: 'qué puede hacer' },
    { momento: 'El nudo', t: T(16, 3), faltan: 27, nota: 'lo que traba un final' },
    { momento: 'El nudo', t: finArbol + 1.0, faltan: 27, nota: 'árbol de correlativas' },
    { momento: 'El nudo', t: M.m4 - 0.2, faltan: 25, nota: 'los finales, rendidos' },
    { momento: '4', t: analista + 1.2, faltan: 20, nota: 'banda de Analista' },
    { momento: '4', t: T(25, 3), faltan: 13 },
    { momento: '5', t: M.cuenta - 0.3, faltan: 13, nota: 'marzo: cursando' },
    { momento: '5', t: M.m6 - 0.5, faltan: 1 },
    { momento: '6', t: corte - 0.3, faltan: 1, nota: 'de "Cursando" a "Aprobada"' },
    { momento: '6', t: R + 2.5, faltan: 0 },
    { momento: '6', t: tIng + 1.5, faltan: 0, nota: 'banda de Ingeniero' },
    { momento: '6', t: tVerde + 2.4, faltan: 0, nota: 'el árbol, todo aprobado' },
    { momento: '6', t: tNotas + 1.5, faltan: 0, nota: 'notas y promedio' },
    { momento: '7', t: cierre.foto + 0.9, faltan: null, nota: 'llega una foto' },
    { momento: '7', t: T(44) - 0.3, faltan: null, nota: 'la libreta de la abuela' },
    { momento: '7', t: DUR - 1.2, faltan: null, nota: 'la invitación' },
  ]

  tomas.sort((a, b) => a.t - b.t)
  sonido.sort((a, b) => a.t - b.t)
  return {
    fps: FPS,
    dur: DUR,
    notas: nota,
    marcas: {
      ...M, abu3: T(13, 2), finLista, arbol, recorreNudo, finArbol, analista, vuelta, uno, corte,
      revelacion: R, compas: COMPAS, golpes, tIng, tVerde, tNotas, bajaNotas, cierre: C0, tarjeta: cierre.tarjeta,
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
