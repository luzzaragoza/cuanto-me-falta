// El plano del árbol de correlativas (rediseño 2-sep): una LÍNEA DE TIEMPO
// horizontal. Cada columna es un cuatrimestre, cada par de columnas un año, y las
// correlativas son curvas que van siempre hacia la derecha. No hay motor de layout:
// la posición de cada materia sale de una cuenta con su índice, así que esto es
// puro, sincrónico y trivial de testear.
//
// Acá murieron dos cosas del árbol anterior, a propósito:
// - El "modo rama" (re-acomodar la cadena con ELK): la cadena ahora se RESALTA en
//   el lugar — naranja lo que necesita, oliva lo que habilita, el resto se apaga.
//   Con eso elkjs y React Flow dejaron de hacer falta (−506 KB gz de chunk).
// - Las rampas por distancia (--need-N / --unlock-N): el diseño usa UN color por
//   sentido, no cuatro por profundidad. La distancia ya la cuenta la geometría:
//   más lejos en la cadena = más columnas de distancia.

/** Lo único que el reductor necesita de una correlativa. `Correlativa` (la clase
 *  del modelo) lo cumple estructuralmente, y los tests pueden armar pares planos. */
export interface ParCorrelativa {
  cod: string
  requiere: string
}

// Geometría del diseño (tarjeta 208×86, calle de 104 entre columnas).
export const NW = 208
export const NH = 86
export const GX = 104
export const GY = 20
export const PAD = 40
export const TOP = 116
export const BOT = 40

/** Qué necesita saber este módulo de un plan. `Plan` lo cumple estructuralmente. */
export interface PlanParaArbol {
  anios: readonly {
    year: number
    cuatris: readonly { n: number; mats: readonly { cod: string; nom: string }[] }[]
  }[]
  antes(cod: string): string[]
  isOpt(cod: string): boolean
  isSpecial(cod: string): boolean
}

export interface NodoPlano {
  cod: string
  nom: string
  x: number
  y: number
  /** Índice de columna (cuatrimestre global, 0-based). */
  col: number
  year: number
  cuatri: number
  opt: boolean
  esp: boolean
}

/** Una correlativa dibujable: de la que se necesita (`de`) a la que la pide (`a`). */
export interface AristaPlana {
  de: string
  a: string
}

export interface BandaAnio {
  x: number
  y: number
  w: number
  h: number
  /** Alternancia visual (una banda sí, una no). */
  alt: boolean
  lx: number
  ly: number
  label: string
  year: number
  /** X de la primera columna del año (para saltar hasta él). */
  colX: number
}

export interface RotuloCuatri {
  x: number
  y: number
  w: number
  label: string
}

export interface PlanoArbol {
  nodos: NodoPlano[]
  porCod: Map<string, NodoPlano>
  /** Reducción transitiva: las correlativas deducibles no se dibujan (el panel
   *  de la materia sigue listándolas todas — decisión del 13-jul, se conserva). */
  aristas: AristaPlana[]
  bandas: BandaAnio[]
  cuatris: RotuloCuatri[]
  w: number
  h: number
}

/** Posiciones, bandas y aristas de un plan completo. Determinista. */
export function planoDe(plan: PlanParaArbol): PlanoArbol {
  // columnas en orden temporal: (año, cuatrimestre) aplanado
  const columnas: { year: number; n: number; mats: { cod: string; nom: string }[] }[] = []
  for (const a of plan.anios)
    for (const q of a.cuatris) columnas.push({ year: a.year, n: q.n, mats: [...q.mats] })

  const maxFilas = Math.max(1, ...columnas.map((c) => c.mats.length))
  const h = TOP + maxFilas * (NH + GY) - GY + BOT

  const nodos: NodoPlano[] = []
  const porCod = new Map<string, NodoPlano>()
  columnas.forEach((c, ci) => {
    // cada columna centrada verticalmente contra la más alta
    const off = ((maxFilas - c.mats.length) / 2) * (NH + GY)
    c.mats.forEach((m, ri) => {
      const nodo: NodoPlano = {
        cod: m.cod,
        nom: m.nom,
        x: PAD + ci * (NW + GX),
        y: Math.round(TOP + off + ri * (NH + GY)),
        col: ci,
        year: c.year,
        cuatri: c.n,
        opt: plan.isOpt(m.cod),
        esp: plan.isSpecial(m.cod),
      }
      nodos.push(nodo)
      porCod.set(m.cod, nodo)
    })
  })

  // aristas: las previas directas de cada materia, sin las deducibles
  const directas: ParCorrelativa[] = []
  for (const n of nodos)
    for (const p of plan.antes(n.cod)) if (porCod.has(p)) directas.push({ cod: n.cod, requiere: p })
  const aristas = reducirTransitivamente(directas).map((c) => ({ de: c.requiere, a: c.cod }))

  // bandas de año: agrupan columnas consecutivas del mismo año
  const bandas: BandaAnio[] = []
  let i = 0
  while (i < columnas.length) {
    let j = i
    while (j + 1 < columnas.length && columnas[j + 1].year === columnas[i].year) j++
    const x0 = PAD + i * (NW + GX)
    const x1 = PAD + j * (NW + GX) + NW
    bandas.push({
      x: x0 - 26,
      y: 52,
      w: x1 - x0 + 52,
      h: h - 52 - 12,
      alt: bandas.length % 2 === 1,
      lx: x0,
      ly: 8,
      label: `${columnas[i].year}° año`,
      year: columnas[i].year,
      colX: x0,
    })
    i = j + 1
  }

  const cuatris: RotuloCuatri[] = columnas.map((c, ci) => ({
    x: PAD + ci * (NW + GX),
    y: 78,
    w: NW,
    label: `${c.n}° cuatrimestre`,
  }))

  return {
    nodos,
    porCod,
    aristas,
    bandas,
    cuatris,
    w: PAD * 2 + columnas.length * NW + (columnas.length - 1) * GX,
    h,
  }
}

/** El path de una arista: curva suave del borde derecho de `de` al izquierdo de `a`. */
export function curvaArista(de: NodoPlano, a: NodoPlano): string {
  const x1 = de.x + NW
  const y1 = de.y + NH / 2
  const x2 = a.x
  const y2 = a.y + NH / 2
  const dx = Math.max(48, (x2 - x1) * 0.5)
  return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`
}

/**
 * El motor de la reducción transitiva (heredado del árbol anterior, mismo código).
 *
 * Los planes declaran correlativas a montones que ya se DEDUCEN de otras — p.ej.
 * Machine Learning I pide Estadística *y* Inferencia, que a su vez pide Estadística:
 * la primera no agrega información. Dibujarlas solo mete flechas redundantes; la
 * dependencia sigue estando, leída por el camino. La cadena resaltada no cambia:
 * la reducción conserva el alcance (hay test de eso).
 */
export function reducirTransitivamente<C extends ParCorrelativa>(correlativas: readonly C[]): C[] {
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
