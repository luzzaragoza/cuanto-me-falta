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

export interface GrafoPlan {
  materias: Pick<MateriaPlan, 'cod' | 'anio' | 'cuatri'>[]
  correlativas: Correlativa[]
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

export interface ArbolLayout {
  pos: Record<string, Punto> // esquina superior izquierda de cada tarjeta
  /** Polilínea absoluta de cada correlativa, por id `requiere->cod`. */
  aristas: Record<string, Punto[]>
  width: number
  height: number
  filas: Fila[] // presentes en el grafo, en orden temporal
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
export const ROWY = 134 // paso vertical entre filas: deja un pasillo para los carriles
const YEAR_GAP = 46 // aire extra entre años: agrupa visualmente (la seña más intuitiva)

/** Salto máximo (en cuatrimestres) para dibujarse en la malla en reposo. */
export const DIST_CORTA = 2
const LANE0 = 16 // 1er carril horizontal, medido desde el pie de la tarjeta
const LANE = 10 // separación entre carriles del mismo pasillo

interface Grilla {
  filas: { cuatri: number; cods: string[] }[] // en orden temporal
  slot: Map<string, number>
  maxLen: number
}

/** Tres barridos de baricentro (bajar, subir, bajar): cada materia se acomoda
 *  cerca del promedio de sus vecinas (así la rama que después se junta viaja
 *  poco). Slots ENTEROS y filas centradas: columnas perfectamente alineadas. */
function grillaMalla(grafo: GrafoPlan): Grilla {
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

/**
 * Ruteo de las correlativas CORTAS sobre la grilla de la malla.
 *
 * No hay búsqueda de caminos ni heurísticas: la grilla es discreta, así que
 * cada arista corta tiene una ruta obvia por los pasillos que quedan ENTRE las
 * filas (ahí no hay ninguna tarjeta, por construcción):
 *  - salto de 1 cuatrimestre → baja al pasillo, corre en su carril, baja al destino;
 *  - salto de 2 → además tiene que cruzar la fila del medio, y lo hace por un
 *    SLOT LIBRE de esa fila (200px de aire), el más cercano al punto medio.
 *
 * Si una arista no encuentra por dónde pasar limpia, devuelve `null` y no se
 * dibuja: preferimos mostrar menos esqueleto antes que volver a la trenza.
 * `invariantes()` verifica en CI que el resultado no cruce ninguna tarjeta.
 */
function rutearCortas(
  grafo: GrafoPlan,
  g: Grilla,
  pos: Record<string, Punto>,
  filaY: number[],
): Record<string, Punto[]> {
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
  for (const c of grafo.correlativas) {
    const qs = cuatriDe.get(c.requiere)
    const qt = cuatriDe.get(c.cod)
    if (qs == null || qt == null || qt - qs < 1 || qt - qs > DIST_CORTA) continue
    const fs = idxFila.get(qs)
    const ft = idxFila.get(qt)
    if (fs == null || ft == null || ft - fs < 1 || ft - fs > 2) continue
    if (!pos[c.requiere] || !pos[c.cod]) continue
    reqs.push({ id: `${c.requiere}->${c.cod}`, src: c.requiere, tgt: c.cod, fs, ft })
  }
  // las de mayor recorrido horizontal toman el carril más alto: quedan anidadas
  // (como los andenes de una estación) en vez de cruzarse entre sí
  const span = (r: Req) => Math.abs(pos[r.src].x - pos[r.tgt].x)
  reqs.sort((a, b) => span(b) - span(a))

  // un pasillo por hueco entre filas; cada arista que dobla toma un carril propio
  const usadosCarril = new Map<number, number>()
  const carril = (i: number): number => {
    const top = filaY[i] + NODEH
    const alto = filaY[i + 1] - top
    const max = Math.max(1, Math.floor((alto - 2 * LANE0) / LANE) + 1)
    const n = usadosCarril.get(i) ?? 0
    usadosCarril.set(i, n + 1)
    return top + LANE0 + (n % max) * LANE
  }

  // Corredores verticales para cruzar una fila intermedia, del más aireado al
  // más justo: (1) el centro de un slot LIBRE de esa fila —200px de aire—,
  // (2) ese mismo slot corrido, (3) el pasillo de 15px que queda entre dos
  // columnas. Nunca dos líneas a menos de 12px: la "trenza" de julio era
  // justamente muchas aristas compartiendo un canal.
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
      cands.push({ x: c, p: puntaje(c, 0) }) // slot libre: 200px de aire
      for (const d of [14, -14, 28, -28]) cands.push({ x: c + d, p: puntaje(c + d, 40) })
    }
    for (let s = 1; s < g.maxLen; s++) {
      const c = xEntreSlots(s)
      cands.push({ x: c, p: puntaje(c, 90) }) // pasillo de 15px: justo, pero limpio
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

  const aristas: Record<string, Punto[]> = {}
  for (const r of reqs) {
    const a = pos[r.src]
    const b = pos[r.tgt]
    const xa = a.x + NODEW / 2
    const xb = b.x + NODEW / 2
    const yArriba = a.y + NODEH
    const yAbajo = b.y

    if (r.ft - r.fs === 1) {
      if (Math.abs(xa - xb) < 0.5) {
        aristas[r.id] = [
          { x: xa, y: yArriba },
          { x: xa, y: yAbajo },
        ]
        continue
      }
      const yl = carril(r.fs)
      aristas[r.id] = [
        { x: xa, y: yArriba },
        { x: xa, y: yl },
        { x: xb, y: yl },
        { x: xb, y: yAbajo },
      ]
      continue
    }

    // salto de 2: hay que atravesar la fila del medio por un slot libre
    const fm = r.fs + 1
    const cx = corredor(fm, xa, xb)
    if (cx == null) continue // sin paso limpio: esta se ve en modo rama
    const y1 = carril(r.fs)
    const y2 = carril(fm)
    const pts: Punto[] = [{ x: xa, y: yArriba }]
    if (Math.abs(xa - cx) >= 0.5) pts.push({ x: xa, y: y1 }, { x: cx, y: y1 })
    if (Math.abs(cx - xb) >= 0.5) pts.push({ x: cx, y: y2 }, { x: xb, y: y2 })
    pts.push({ x: xb, y: yAbajo })
    aristas[r.id] = pts
  }
  return aristas
}

/** La MALLA en reposo: grilla exacta + las correlativas cortas ruteadas por los
 *  pasillos. Columnas en slots, respiro entre años, y las largas en modo rama. */
export async function layoutMalla(grafo: GrafoPlan): Promise<ArbolLayout> {
  const g = grillaMalla(grafo)
  const pos: ArbolLayout['pos'] = {}
  const filas: Fila[] = []
  const filaY: number[] = []
  let y = PADY
  let anioPrevio: number | null = null
  for (const f of g.filas) {
    const anio = Math.floor(f.cuatri / 2)
    if (anioPrevio !== null && anio !== anioPrevio) y += YEAR_GAP
    anioPrevio = anio
    for (const cod of f.cods) pos[cod] = { x: PADX + g.slot.get(cod)! * NODEX, y }
    filas.push({ cuatri: f.cuatri, top: y, bottom: y + NODEH })
    filaY.push(y)
    y += ROWY
  }
  return {
    pos,
    aristas: rutearCortas(grafo, g, pos, filaY),
    width: PADX * 2 + (g.maxLen - 1) * NODEX + NODEW,
    height: y - ROWY + NODEH + 28,
    filas,
  }
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
export async function layoutGrafo(grafo: GrafoPlan): Promise<ArbolLayout> {
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

  const pos: ArbolLayout['pos'] = {}
  for (const n of res.children ?? []) pos[n.id] = { x: (n.x ?? 0) + PADX, y: (n.y ?? 0) + PADY }

  const aristas: ArbolLayout['aristas'] = {}
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

  return {
    pos,
    aristas,
    width: (res.width ?? 0) + PADX * 2,
    height: (res.height ?? 0) + PADY + 24,
    filas,
  }
}

/** La cadena completa de una materia: lo que necesita (up) y lo que habilita (down). */
export function cadenaDe(correlativas: Correlativa[], foco: string): { up: Set<string>; down: Set<string> } {
  const up = new Set<string>()
  const down = new Set<string>()
  const subir = (cod: string) => {
    for (const c of correlativas) {
      if (c.cod === cod && !up.has(c.requiere)) {
        up.add(c.requiere)
        subir(c.requiere)
      }
    }
  }
  const bajar = (cod: string) => {
    for (const c of correlativas) {
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

/** Subgrafo del "modo rama": la materia + su cadena, con solo las correlativas internas. */
export function subgrafoRama(grafo: GrafoPlan, foco: string): GrafoPlan {
  const { up, down } = cadenaDe(grafo.correlativas, foco)
  const cods = new Set([foco, ...up, ...down])
  return {
    materias: grafo.materias.filter((m) => cods.has(m.cod)),
    correlativas: grafo.correlativas.filter((c) => cods.has(c.cod) && cods.has(c.requiere)),
  }
}

// ---- invariantes geométricos (los verifica CI para cada plan y cada rama) ----

export interface Invariantes {
  /** Segmentos de arista que atraviesan una tarjeta ajena. */
  cruces: number
  /** Verticales de aristas de DISTINTO origen a menos de 8px (tronco compartido no cuenta). */
  pegados: number
  /** Aristas que no fluyen hacia abajo. */
  haciaArriba: number
  /** Filas fuera de orden temporal (un cuatrimestre posterior por encima de uno anterior). */
  filasDesordenadas: number
}

export function invariantes(lay: ArbolLayout): Invariantes {
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

  const vert = segs.filter((s) => Math.abs(s.x1 - s.x2) < 0.5 && Math.abs(s.y1 - s.y2) > 4)
  let pegados = 0
  for (let i = 0; i < vert.length; i++)
    for (let j = i + 1; j < vert.length; j++) {
      const a = vert[i]
      const b = vert[j]
      if (a.src === b.src) continue // mismo origen pegado = tronco compartido a propósito
      const dx = Math.abs(a.x1 - b.x1)
      const aTop = Math.min(a.y1, a.y2)
      const aBot = Math.max(a.y1, a.y2)
      const bTop = Math.min(b.y1, b.y2)
      const bBot = Math.max(b.y1, b.y2)
      const solapan = Math.max(aTop, bTop) < Math.min(aBot, bBot)
      if (dx > 0.5 && dx < 8 && solapan) pegados++
    }

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
