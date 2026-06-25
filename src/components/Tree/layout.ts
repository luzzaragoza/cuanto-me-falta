import { plan } from '../../domain/Plan'

// Layout vertical (top-to-bottom): una FILA por año, materias lado a lado.
// "Antes" (correlativas previas) queda arriba; "después" (lo que habilita) abajo.
export const NODEX = 215 // paso horizontal entre materias del mismo año
export const NODEW = 200 // ancho del nodo
export const YEARY = 165 // paso vertical entre años
const PADX = 40
const PADY = 64

export interface Banda {
  x: number
  y: number
  width: number
  height: number
  year: number
  titulo?: string
  alt: boolean
}

export interface TreeLayout {
  pos: Record<string, { x: number; y: number }>
  bands: Banda[]
  width: number
}

/** Posiciones de cada materia + las bandas de fondo por año. */
export function layout(): TreeLayout {
  const pos: Record<string, { x: number; y: number }> = {}
  const maxCols = Math.max(
    ...plan.anios.map((a) => a.cuatris.reduce((n, q) => n + q.mats.length, 0)),
  )
  const width = PADX * 2 + (maxCols - 1) * NODEX + NODEW
  const bands: Banda[] = []
  plan.anios.forEach((a, yi) => {
    const y = PADY + yi * YEARY
    let col = 0
    a.cuatris.forEach((q) =>
      q.mats.forEach((m) => {
        pos[m.cod] = { x: PADX + col * NODEX, y }
        col++
      }),
    )
    bands.push({
      x: 0,
      y: y - 42,
      width,
      height: YEARY,
      year: a.year,
      titulo: a.titulo,
      alt: yi % 2 === 1,
    })
  })
  return { pos, bands, width }
}
