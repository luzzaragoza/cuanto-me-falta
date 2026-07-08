import { plan } from '../../domain/Plan'

// Layout vertical (top-to-bottom): una FILA por año, materias lado a lado.
// "Antes" (correlativas previas) queda arriba; "después" (lo que habilita) abajo.
// Dentro de cada año, un hueco extra (CUATRI_GAP) separa el 1° del 2° cuatrimestre.
export const NODEX = 215 // paso horizontal entre materias del mismo cuatrimestre
export const NODEW = 200 // ancho del nodo
export const YEARY = 165 // paso vertical entre años
export const CUATRI_GAP = 44 // hueco extra entre cuatrimestres
const PADX = 40
const PADY = 64

export interface CuatriMark {
  n: number // número de cuatrimestre (1, 2, …)
  x: number // x del inicio del grupo (borde izq. de la 1ª materia)
  w: number // ancho del grupo (hasta el borde der. de la última)
}

export interface Banda {
  x: number
  y: number
  width: number
  height: number
  year: number
  titulo?: string
  alt: boolean
  cuatris: CuatriMark[]
}

export interface TreeLayout {
  pos: Record<string, { x: number; y: number }>
  bands: Banda[]
  width: number
}

/** Posiciones de cada materia + las bandas de fondo por año (con sus cuatrimestres). */
export function layout(): TreeLayout {
  const pos: Record<string, { x: number; y: number }> = {}
  const matsPorAnio = plan.anios.map((a) => a.cuatris.reduce((n, q) => n + q.mats.length, 0))
  const maxMats = Math.max(...matsPorAnio)
  const maxGaps = Math.max(...plan.anios.map((a) => Math.max(a.cuatris.length - 1, 0)))
  const width = PADX * 2 + (maxMats - 1) * NODEX + NODEW + maxGaps * CUATRI_GAP
  const bands: Banda[] = []
  plan.anios.forEach((a, yi) => {
    const y = PADY + yi * YEARY
    let x = PADX
    const cuatris: CuatriMark[] = []
    a.cuatris.forEach((q, qi) => {
      if (qi > 0) x += CUATRI_GAP // hueco entre cuatrimestres
      const x0 = x
      q.mats.forEach((m) => {
        pos[m.cod] = { x, y }
        x += NODEX
      })
      if (q.mats.length) cuatris.push({ n: qi + 1, x: x0, w: x - NODEX + NODEW - x0 })
    })
    bands.push({
      x: 0,
      y: y - 42,
      width,
      height: YEARY,
      year: a.year,
      titulo: a.titulo,
      alt: yi % 2 === 1,
      cuatris,
    })
  })
  return { pos, bands, width }
}
