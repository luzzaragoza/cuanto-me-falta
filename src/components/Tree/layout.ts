import { plan } from '../../domain/Plan'

// Layout vertical (top-to-bottom): una FILA por año, materias lado a lado.
// "Antes" (correlativas previas) queda arriba; "después" (lo que habilita) abajo.
export const NODEX = 215 // paso horizontal entre materias del mismo año
export const YEARY = 165 // paso vertical entre años
const PADX = 40
const PADY = 64

export interface TreeLayout {
  pos: Record<string, { x: number; y: number }>
  years: { x: number; y: number }[]
}

/** Posiciones de cada materia y de cada rótulo de año. */
export function layout(): TreeLayout {
  const pos: Record<string, { x: number; y: number }> = {}
  const years: { x: number; y: number }[] = []
  plan.anios.forEach((a, yi) => {
    const y = PADY + yi * YEARY
    let col = 0
    a.cuatris.forEach((q) =>
      q.mats.forEach((m) => {
        pos[m.cod] = { x: PADX + col * NODEX, y }
        col++
      }),
    )
    years.push({ x: PADX, y: y - 36 })
  })
  return { pos, years }
}
