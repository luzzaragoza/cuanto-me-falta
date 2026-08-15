// Motor de layout del árbol de correlativas (árbol v2).
//
// ELK (Eclipse Layout Kernel, algoritmo 'layered') reemplaza TODO el ruteo
// artesanal que teníamos (baricentro + carriles + canales): el motor garantiza
// por construcción lo que antes intentábamos con ifs — aristas ortogonales
// siempre separadas, fan-out como tronco compartido, nada por encima de las
// tarjetas. La decisión y el benchmark (hub 3.4.207 en Ing.) están en el ADR.
//
// Dos usos:
//  - `layoutGrafo(grafo)`  → la MALLA completa del plan (reposo).
//  - `layoutGrafo(subgrafoRama(grafo, foco))` → la RAMA de una materia,
//    compacta ("modo rama": el clic junta la línea de correlatividades como
//    un árbol — idea de Luz, 17-jul).
//
// En ambos, una FILA por CUATRIMESTRE (partición ELK por índice global de
// cuatri): lo vertical siempre es tiempo, y el "escalonado" de la rama sale
// gratis — lo que sigue después está siempre un escalón más abajo.
//
// Es TypeScript puro y ELK corre también en node → los invariantes geométricos
// de abajo se verifican en CI para cada plan (y cada rama) presente y futuro.

import ELK from 'elkjs/lib/elk.bundled.js'
import type { ElkNode } from 'elkjs'
import type { Correlativa, MateriaPlan } from '../data/model'

export const NODEW = 200 // ancho de la tarjeta (igual que la estética de la malla)
export const NODEH = 64 // alto máximo (nombre de hasta 3 líneas)
export const PADX = 48 // aire a la izquierda (deja lugar al rail de años)
const PADY = 56 // aire arriba (rótulo del primer cuatrimestre)

/** Lo mínimo de una materia que el layout necesita: dónde va y cómo se llama. */
export type MateriaEnGrafo = Pick<MateriaPlan, 'cod' | 'anio' | 'cuatri'>

/**
 * El grafo de un plan, listo para dibujar.
 *
 * Sabe responder sobre su propia forma (`cadenaDe`, `reducido`, `rama`) y sabe pedirle
 * al motor que lo acomode (`malla`, `layout`). Antes eran seis funciones sueltas que
 * recibían el mismo `{materias, correlativas}` como primer parámetro.
 */
export class Grafo {
  readonly materias: readonly MateriaEnGrafo[]
  readonly correlativas: readonly Correlativa[]

  constructor(materias: readonly MateriaEnGrafo[], correlativas: readonly Correlativa[]) {
    this.materias = materias
    this.correlativas = correlativas
  }

  /** El grafo completo de un plan. */
  static dePlan(plan: { materias: readonly MateriaEnGrafo[]; correlativas: readonly Correlativa[] }): Grafo {
    return new Grafo(plan.materias, plan.correlativas)
  }

  /** La cadena completa de una materia: lo que necesita (`up`) y lo que habilita (`down`). */
  cadenaDe(foco: string): { up: Set<string>; down: Set<string> } {
    const up = new Set<string>()
    const down = new Set<string>()
    const subir = (cod: string): void => {
      for (const c of this.correlativas) {
        if (c.cod === cod && !up.has(c.requiere)) {
          up.add(c.requiere)
          subir(c.requiere)
        }
      }
    }
    const bajar = (cod: string): void => {
      for (const c of this.correlativas) {
        if (c.requiere === cod && !down.has(c.cod)) {
          down.add(c.cod)
          bajar(c.cod)
        }
      }
    }
    subir(foco)
    bajar(foco)
    return { up, down }
  }

  /**
   * El mismo grafo sin las correlativas que ya se DEDUCEN de otras.
   *
   * Los planes las tienen a montones — p.ej. Machine Learning I pide Estadística General
   * *y* Inferencia, que a su vez pide Estadística: la primera no agrega información,
   * porque no podés tener Inferencia sin Estadística. Dibujarlas es peor que no hacerlo:
   * la flecha tiene que RODEAR la materia del medio (se ve como un lazo), y si además
   * sale del mismo nodo que otra, ELK las fusiona en un tronco compartido que nosotros
   * pintamos de dos colores distintos.
   *
   * Sacarlas no pierde nada: la dependencia sigue estando, leída por el camino. Y
   * garantiza algo lindo: después de reducir, ninguna arista puede ir de la parte
   * "necesitás" a la parte "habilita" (ese salto siempre pasa por el foco), así que
   * ningún tronco puede quedar bicolor. Los tests lo verifican.
   */
  reducido(): Grafo {
    return new Grafo(this.materias, reducirTransitivamente(this.correlativas))
  }

  /**
   * El subgrafo del "modo rama": la materia + su cadena, con solo las correlativas
   * internas y sin las que se deducen de otras.
   */
  rama(foco: string): Grafo {
    const { up, down } = this.cadenaDe(foco)
    const cods = new Set([foco, ...up, ...down])
    return new Grafo(
      this.materias.filter((m) => cods.has(m.cod)),
      this.correlativas.filter((c) => cods.has(c.cod) && cods.has(c.requiere)),
    ).reducido()
  }

  /** La malla en reposo: grilla exacta nuestra, con las correlativas cortas ruteadas. */
  malla(): Promise<Layout> {
    return layoutMalla(this)
  }

  /** El layout por capas de ELK. Es el que dibuja el modo rama. */
  layout(): Promise<Layout> {
    return layoutGrafo(this)
  }
}

export interface Punto {
  x: number
  y: number
}

export interface Fila {
  cuatri: number // índice global (0 = 1°año 1°C, 1 = 1°año 2°C, …)
  top: number
  bottom: number
}

/**
 * El resultado de acomodar un grafo: dónde va cada tarjeta y por dónde pasa cada flecha.
 *
 * `Punto` y `Fila` quedan como formas y no como clases por la misma razón que
 * `data/json.ts`: son el DATO que sale del cálculo, y se los consume tal cual (React
 * Flow espera `{x, y}`). El objeto con conducta es este.
 */
export class Layout {
  /** Esquina superior izquierda de cada tarjeta. */
  readonly pos: Record<string, Punto>
  /** Polilínea absoluta de cada correlativa, por id `requiere->cod`. */
  readonly aristas: Record<string, Punto[]>
  readonly width: number
  readonly height: number
  /** Filas presentes en el grafo, en orden temporal. */
  readonly filas: Fila[]

  constructor(campos: {
    pos: Record<string, Punto>
    aristas: Record<string, Punto[]>
    width: number
    height: number
    filas: Fila[]
  }) {
    this.pos = campos.pos
    this.aristas = campos.aristas
    this.width = campos.width
    this.height = campos.height
    this.filas = campos.filas
  }

  /** Los invariantes geométricos de ESTE layout (los verifica CI para cada plan). */
  get invariantes(): Invariantes {
    return medirInvariantes(this)
  }
}

const cuatriIdx = (m: Pick<MateriaPlan, 'anio' | 'cuatri'>) => (m.anio - 1) * 2 + (m.cuatri - 1)

const elk = new ELK()

// ── grilla de la malla (reposo) ──
// El mapa del plan es una GRILLA exacta y compacta (feedback de Luz: ELK
// esparcía las materias y "quedaba infinito de recorrer"; y las columnas
// corridas para abrir canales tampoco convencieron): columnas en slots exactos
// y un respiro entre años.
//
// En reposo se dibujan las correlativas CORTAS (ver `DIST_CORTA`). El 18-jul no
// se dibujaba ninguna, porque dibujarlas TODAS armaba la "trenza" que hizo
// revertir el rediseño de julio; pero medido sobre los 4 planes, el 83% de las
// correlativas salta 1 o 2 cuatrimestres y esas se rutean por los pasillos
// entre filas sin cruzar nada. Las largas (17%) siguen apareciendo solo al
// tocar la materia (modo rama). Regla dura, verificada en CI: si una arista NO
// se puede rutear limpia, NO se dibuja — nunca se ensucia la malla.
export const NODEX = 215 // paso horizontal entre columnas de la grilla
const YEAR_GAP = 46 // aire extra entre años: agrupa visualmente (la seña más intuitiva)

/** Salto máximo (en cuatrimestres) para dibujarse en la malla en reposo. */
export const DIST_CORTA = 2
const PASILLO_MIN = 46 // hueco entre filas cuando no pasa ninguna flecha
const LANE0 = 17 // del pie de la tarjeta al primer carril
const LANE = 14 // separación entre carriles: tienen que LEERSE separados
const LANE_FIN = 17 // del último carril a la fila de abajo
const LANE_SEP_X = 18 // aire mínimo entre dos horizontales que comparten carril

interface Grilla {
  filas: { cuatri: number; cods: string[] }[] // en orden temporal
  slot: Map<string, number>
  maxLen: number
}

/** Tres barridos de baricentro (bajar, subir, bajar): cada materia se acomoda
 *  cerca del promedio de sus vecinas (así la rama que después se junta viaja
 *  poco). Slots ENTEROS y filas centradas: columnas perfectamente alineadas. */
function grillaMalla(grafo: Grafo): Grilla {
  const porFila = new Map<number, string[]>()
  for (const m of grafo.materias) {
    const q = cuatriIdx(m)
    const fila = porFila.get(q) ?? []
    fila.push(m.cod)
    porFila.set(q, fila)
  }
  const entradas = [...porFila.entries()].sort(([a], [b]) => a - b)
  const filas = entradas.map(([, f]) => f)

  const antes = new Map<string, string[]>()
  const despues = new Map<string, string[]>()
  for (const c of grafo.correlativas) {
    ;(antes.get(c.cod) ?? antes.set(c.cod, []).get(c.cod)!).push(c.requiere)
    ;(despues.get(c.requiere) ?? despues.set(c.requiere, []).get(c.requiere)!).push(c.cod)
  }

  const maxLen = Math.max(...filas.map((f) => f.length))
  const absx = new Map<string, number>()
  const ubicar = (fila: string[]) => {
    const off = Math.floor((maxLen - fila.length) / 2)
    fila.forEach((cod, i) => absx.set(cod, i + off))
  }
  filas.forEach(ubicar)
  const pasada = (orden: string[][], vecinos: (c: string) => string[]) => {
    for (const fila of orden) {
      const bary = new Map<string, number>()
      for (const cod of fila) {
        const xs = vecinos(cod)
          .map((v) => absx.get(v))
          .filter((x): x is number => x != null)
        bary.set(cod, xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : absx.get(cod)!)
      }
      fila.sort((a, b) => bary.get(a)! - bary.get(b)!) // sort estable: empates quietos
      ubicar(fila)
    }
  }
  pasada(filas, (c) => antes.get(c) ?? [])
  pasada([...filas].reverse(), (c) => despues.get(c) ?? [])
  pasada(filas, (c) => antes.get(c) ?? [])

  return {
    filas: entradas.map(([cuatri], i) => ({ cuatri, cods: filas[i] })),
    slot: absx,
    maxLen,
  }
}

/** Un tramo horizontal que ocupa un carril del pasillo `gap`, de `x1` a `x2`. */
interface Tramo {
  gap: number
  x1: number
  x2: number
  carril: number
}
interface Ruta {
  id: string
  src: string
  tgt: string
  fs: number
  ft: number
  cx: number | null // corredor vertical para cruzar la fila del medio (salto de 2)
  h1: Tramo | null // tramo horizontal en el pasillo de arriba
  h2: Tramo | null // tramo horizontal en el pasillo de abajo (salto de 2)
}

/**
 * PLAN de ruteo de las correlativas CORTAS. Se decide con las X (que salen de
 * la grilla) pero SIN las Y, porque el alto de cada pasillo depende justamente
 * de cuántos carriles necesite — primero se planifica, después se acomodan las
 * filas. No hay búsqueda de caminos: la grilla es discreta y cada arista corta
 * tiene una ruta obvia por los pasillos que quedan ENTRE las filas (ahí no hay
 * ninguna tarjeta, por construcción):
 *  - salto de 1 cuatrimestre → baja al pasillo, corre por su carril, baja al destino;
 *  - salto de 2 → además cruza la fila del medio por un SLOT LIBRE de esa fila
 *    (200px de aire) o, si no hay, por el pasillo entre columnas.
 *
 * Los carriles se reparten con **coloreo de intervalos** (greedy por extremo
 * izquierdo): dos horizontales que se solapan JAMÁS caen en el mismo carril, y
 * las que no se solapan lo comparten sin gastar alto. Es lo que evita que las
 * flechas se toquen entre sí — `invariantes()` lo verifica en CI.
 *
 * Si una arista no encuentra paso limpio se descarta: preferimos mostrar menos
 * esqueleto antes que volver a la trenza.
 */
function planearCortas(
  grafo: Grafo,
  g: Grilla,
  xc: (cod: string) => number,
): { rutas: Ruta[]; carriles: number[] } {
  const idxFila = new Map<number, number>()
  g.filas.forEach((f, i) => idxFila.set(f.cuatri, i))
  const ocupados = g.filas.map((f) => new Set(f.cods.map((c) => g.slot.get(c)!)))
  const cuatriDe = new Map(grafo.materias.map((m) => [m.cod, cuatriIdx(m)]))

  interface Req {
    id: string
    src: string
    tgt: string
    fs: number
    ft: number
  }
  const reqs: Req[] = []
  // sin las que se deducen de otras: en la malla son justo las que necesitan
  // atravesar una fila (la del medio es la que las vuelve redundantes)
  for (const c of reducirTransitivamente(grafo.correlativas)) {
    const qs = cuatriDe.get(c.requiere)
    const qt = cuatriDe.get(c.cod)
    if (qs == null || qt == null || qt - qs < 1 || qt - qs > DIST_CORTA) continue
    const fs = idxFila.get(qs)
    const ft = idxFila.get(qt)
    if (fs == null || ft == null || ft - fs < 1 || ft - fs > 2) continue
    if (g.slot.get(c.requiere) == null || g.slot.get(c.cod) == null) continue
    reqs.push({ id: `${c.requiere}->${c.cod}`, src: c.requiere, tgt: c.cod, fs, ft })
  }
  // las de tramo más corto eligen corredor primero: son las que menos opciones
  // tienen (la ventana entre las dos materias es angosta)
  const span = (r: Req) => Math.abs(xc(r.src) - xc(r.tgt))
  reqs.sort((a, b) => span(a) - span(b))

  // Corredores verticales para cruzar una fila intermedia, del más aireado al
  // más justo: (1) el centro de un slot LIBRE de esa fila —200px de aire—,
  // (2) ese mismo slot corrido, (3) el pasillo de 15px entre dos columnas.
  // Nunca dos a menos de 12px: la "trenza" de julio era exactamente muchas
  // aristas compartiendo un canal.
  const usadosCorr = new Map<number, number[]>()
  const xDeSlot = (s: number) => PADX + s * NODEX + NODEW / 2
  const xEntreSlots = (s: number) => PADX + s * NODEX - (NODEX - NODEW) / 2
  const corredor = (fm: number, xa: number, xb: number): number | null => {
    const lo = Math.min(xa, xb)
    const hi = Math.max(xa, xb)
    const meta = (xa + xb) / 2
    // Salirse del tramo que une las dos materias es lo que se ve MAL (la flecha
    // se va al margen y vuelve), así que pesa mucho más que pasar apretado.
    const afuera = (x: number) => (x < lo ? lo - x : x > hi ? x - hi : 0)
    const puntaje = (x: number, pena: number) => afuera(x) * 3 + Math.abs(x - meta) * 0.2 + pena
    const cands: { x: number; p: number }[] = []
    for (let s = 0; s < g.maxLen; s++) {
      if (ocupados[fm].has(s)) continue
      const c = xDeSlot(s)
      cands.push({ x: c, p: puntaje(c, 0) })
      for (const d of [14, -14, 28, -28]) cands.push({ x: c + d, p: puntaje(c + d, 40) })
    }
    for (let s = 1; s < g.maxLen; s++) {
      const c = xEntreSlots(s)
      cands.push({ x: c, p: puntaje(c, 90) })
    }
    cands.sort((a, b) => a.p - b.p)
    const usados = usadosCorr.get(fm) ?? []
    for (const c of cands) {
      if (usados.some((u) => Math.abs(u - c.x) < 12)) continue
      usados.push(c.x)
      usadosCorr.set(fm, usados)
      return c.x
    }
    return null
  }

  const tramo = (gap: number, a: number, b: number): Tramo => ({
    gap,
    x1: Math.min(a, b),
    x2: Math.max(a, b),
    carril: 0,
  })
  const rutas: Ruta[] = []
  for (const r of reqs) {
    const xa = xc(r.src)
    const xb = xc(r.tgt)
    if (r.ft - r.fs === 1) {
      const recta = Math.abs(xa - xb) < 0.5
      rutas.push({ ...r, cx: null, h1: recta ? null : tramo(r.fs, xa, xb), h2: null })
      continue
    }
    const fm = r.fs + 1
    const cx = corredor(fm, xa, xb)
    if (cx == null) continue // sin paso limpio: esta se ve solo en modo rama
    rutas.push({
      ...r,
      cx,
      h1: Math.abs(xa - cx) < 0.5 ? null : tramo(r.fs, xa, cx),
      h2: Math.abs(cx - xb) < 0.5 ? null : tramo(fm, cx, xb),
    })
  }

  // coloreo de intervalos por pasillo: el carril más bajo que quede libre
  const carriles = g.filas.map(() => 0)
  const porGap = new Map<number, Tramo[]>()
  for (const r of rutas)
    for (const t of [r.h1, r.h2])
      if (t) (porGap.get(t.gap) ?? porGap.set(t.gap, []).get(t.gap)!).push(t)
  for (const [gap, tramos] of porGap) {
    tramos.sort((a, b) => a.x1 - b.x1 || b.x2 - a.x2)
    const finDe: number[] = [] // hasta dónde llega lo último puesto en cada carril
    for (const t of tramos) {
      let c = 0
      while (c < finDe.length && finDe[c] + LANE_SEP_X > t.x1) c++
      t.carril = c
      finDe[c] = t.x2
    }
    carriles[gap] = finDe.length
  }
  return { rutas, carriles }
}

/** La MALLA en reposo: grilla exacta + las correlativas cortas ruteadas por los
 *  pasillos, que crecen solo lo necesario para los carriles que pasan. */
async function layoutMalla(grafo: Grafo): Promise<Layout> {
  const g = grillaMalla(grafo)
  const xDe = new Map<string, number>()
  for (const f of g.filas)
    for (const cod of f.cods) xDe.set(cod, PADX + g.slot.get(cod)! * NODEX + NODEW / 2)
  const { rutas, carriles } = planearCortas(grafo, g, (cod) => xDe.get(cod)!)

  const pos: Layout['pos'] = {}
  const filas: Fila[] = []
  const filaY: number[] = []
  let y = PADY
  let anioPrevio: number | null = null
  g.filas.forEach((f, i) => {
    const anio = Math.floor(f.cuatri / 2)
    if (anioPrevio !== null && anio !== anioPrevio) y += YEAR_GAP
    anioPrevio = anio
    for (const cod of f.cods) pos[cod] = { x: xDe.get(cod)! - NODEW / 2, y }
    filas.push({ cuatri: f.cuatri, top: y, bottom: y + NODEH })
    filaY.push(y)
    const n = carriles[i]
    y += NODEH + Math.max(PASILLO_MIN, n ? LANE0 + (n - 1) * LANE + LANE_FIN : 0)
  })
  const ultima = filas[filas.length - 1]

  const yCarril = (t: Tramo) => filaY[t.gap] + NODEH + LANE0 + t.carril * LANE
  const aristas: Layout['aristas'] = {}
  for (const r of rutas) {
    const xa = xDe.get(r.src)!
    const xb = xDe.get(r.tgt)!
    const pts: Punto[] = [{ x: xa, y: pos[r.src].y + NODEH }]
    if (r.h1) pts.push({ x: xa, y: yCarril(r.h1) }, { x: r.cx ?? xb, y: yCarril(r.h1) })
    if (r.h2 && r.cx != null)
      pts.push({ x: r.cx, y: yCarril(r.h2) }, { x: xb, y: yCarril(r.h2) })
    pts.push({ x: xb, y: pos[r.tgt].y })
    aristas[r.id] = pts
  }

  return new Layout({
    pos,
    aristas,
    width: PADX * 2 + (g.maxLen - 1) * NODEX + NODEW,
    height: ultima.bottom + 28,
    filas,
  })
}

const OPCIONES = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  // una fila por cuatrimestre: partición = índice global de cuatri
  'elk.partitioning.activate': 'true',
  // CLAVE: sin esto ELK separa los componentes conexos (p.ej. las materias sin
  // correlativas) y los empaqueta aparte, rompiendo el orden temporal de filas
  'elk.separateConnectedComponents': 'false',
  // ortogonal + fan-out como tronco compartido ("línea de subte")
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.mergeEdges': 'true',
  // respetar el orden del plan dentro de lo que el cruce de aristas permita
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.spacing.nodeNode': '22',
  'elk.layered.spacing.nodeNodeBetweenLayers': '56',
  'elk.spacing.edgeNode': '14',
  'elk.spacing.edgeEdge': '12',
  'elk.layered.spacing.edgeNodeBetweenLayers': '16',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
}

/** Corre ELK sobre un grafo (en la app: el subgrafo del modo rama). */
async function layoutGrafo(grafo: Grafo): Promise<Layout> {
  const entrada: ElkNode = {
    id: 'root',
    layoutOptions: OPCIONES,
    children: grafo.materias.map((m) => ({
      id: m.cod,
      width: NODEW,
      height: NODEH,
      layoutOptions: { 'elk.partitioning.partition': String(cuatriIdx(m)) },
    })),
    edges: grafo.correlativas.map((c) => ({
      id: `${c.requiere}->${c.cod}`,
      sources: [c.requiere],
      targets: [c.cod],
    })),
  }
  const res = await elk.layout(entrada)

  const pos: Layout['pos'] = {}
  for (const n of res.children ?? []) pos[n.id] = { x: (n.x ?? 0) + PADX, y: (n.y ?? 0) + PADY }

  const aristas: Layout['aristas'] = {}
  for (const e of res.edges ?? []) {
    const s = e.sections?.[0]
    if (!s) continue
    aristas[e.id] = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map((p) => ({
      x: p.x + PADX,
      y: p.y + PADY,
    }))
  }

  const porCuatri = new Map<number, { top: number; bottom: number }>()
  const idxDe = new Map(grafo.materias.map((m) => [m.cod, cuatriIdx(m)]))
  for (const m of grafo.materias) {
    const p = pos[m.cod]
    if (!p) continue
    const q = idxDe.get(m.cod)!
    const f = porCuatri.get(q) ?? { top: Infinity, bottom: -Infinity }
    f.top = Math.min(f.top, p.y)
    f.bottom = Math.max(f.bottom, p.y + NODEH)
    porCuatri.set(q, f)
  }
  const filas: Fila[] = [...porCuatri.entries()]
    .map(([cuatri, f]) => ({ cuatri, ...f }))
    .sort((a, b) => a.cuatri - b.cuatri)

  return new Layout({
    pos,
    aristas,
    width: (res.width ?? 0) + PADX * 2,
    height: (res.height ?? 0) + PADY + 24,
    filas,
  })
}

/** El motor de la reducción transitiva. La usa `Grafo.reducido()`. */
function reducirTransitivamente(correlativas: readonly Correlativa[]): Correlativa[] {
  const sig = new Map<string, string[]>()
  for (const c of correlativas)
    (sig.get(c.requiere) ?? sig.set(c.requiere, []).get(c.requiere)!).push(c.cod)
  // ¿se llega de `u` a `v` dando MÁS de un paso? (el salto directo no cuenta)
  const porOtroCamino = (u: string, v: string): boolean => {
    const vistos = new Set<string>()
    const pila = (sig.get(u) ?? []).filter((w) => w !== v)
    while (pila.length) {
      const w = pila.pop()!
      if (w === v) return true
      if (vistos.has(w)) continue
      vistos.add(w)
      for (const x of sig.get(w) ?? []) pila.push(x)
    }
    return false
  }
  return correlativas.filter((c) => !porOtroCamino(c.requiere, c.cod))
}

// ---- invariantes geométricos (los verifica CI para cada plan y cada rama) ----

export interface Invariantes {
  /** Segmentos de arista que atraviesan una tarjeta ajena. */
  cruces: number
  /** Segmentos PARALELOS de aristas de distinto origen que corren a menos de 8px
   *  solapándose (verticales y horizontales). Es "las flechas se tocan entre sí":
   *  el tronco compartido —mismo origen— no cuenta, ese es a propósito. */
  pegados: number
  /** Aristas que no fluyen hacia abajo. */
  haciaArriba: number
  /** Filas fuera de orden temporal (un cuatrimestre posterior por encima de uno anterior). */
  filasDesordenadas: number
}

function medirInvariantes(lay: Layout): Invariantes {
  interface Seg {
    x1: number
    y1: number
    x2: number
    y2: number
    src: string
    tgt: string
  }
  const segs: Seg[] = []
  for (const [id, pts] of Object.entries(lay.aristas)) {
    const [src, tgt] = id.split('->')
    for (let i = 0; i < pts.length - 1; i++)
      segs.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y, src, tgt })
  }

  let cruces = 0
  const M = 1 // margen numérico
  for (const s of segs) {
    for (const [cod, p] of Object.entries(lay.pos)) {
      if (cod === s.src || cod === s.tgt) continue
      const minX = Math.min(s.x1, s.x2)
      const maxX = Math.max(s.x1, s.x2)
      const minY = Math.min(s.y1, s.y2)
      const maxY = Math.max(s.y1, s.y2)
      if (maxX > p.x + M && minX < p.x + NODEW - M && maxY > p.y + M && minY < p.y + NODEH - M)
        cruces++
    }
  }

  // paralelas pegadas, en los dos sentidos: `fijo` es la coordenada constante del
  // segmento (la x de una vertical, la y de una horizontal) y `de`/`a` su extensión
  const paralelas = (
    filtro: (s: Seg) => boolean,
    fijo: (s: Seg) => number,
    de: (s: Seg) => number,
    a: (s: Seg) => number,
  ): number => {
    const ss = segs.filter(filtro)
    let n = 0
    for (let i = 0; i < ss.length; i++)
      for (let j = i + 1; j < ss.length; j++) {
        if (ss[i].src === ss[j].src) continue // tronco compartido: a propósito
        const d = Math.abs(fijo(ss[i]) - fijo(ss[j]))
        if (d <= 0.5 || d >= 8) continue
        const desde = Math.max(Math.min(de(ss[i]), a(ss[i])), Math.min(de(ss[j]), a(ss[j])))
        const hasta = Math.min(Math.max(de(ss[i]), a(ss[i])), Math.max(de(ss[j]), a(ss[j])))
        if (desde < hasta) n++
      }
    return n
  }
  const pegados =
    paralelas(
      (s) => Math.abs(s.x1 - s.x2) < 0.5 && Math.abs(s.y1 - s.y2) > 4,
      (s) => s.x1,
      (s) => s.y1,
      (s) => s.y2,
    ) +
    paralelas(
      (s) => Math.abs(s.y1 - s.y2) < 0.5 && Math.abs(s.x1 - s.x2) > 4,
      (s) => s.y1,
      (s) => s.x1,
      (s) => s.x2,
    )

  let haciaArriba = 0
  for (const pts of Object.values(lay.aristas)) {
    if (pts.length >= 2 && pts[pts.length - 1].y <= pts[0].y) haciaArriba++
  }

  let filasDesordenadas = 0
  for (let i = 1; i < lay.filas.length; i++) {
    if (lay.filas[i].top <= lay.filas[i - 1].bottom - NODEH / 2) filasDesordenadas++
  }

  return { cruces, pegados, haciaArriba, filasDesordenadas }
}
