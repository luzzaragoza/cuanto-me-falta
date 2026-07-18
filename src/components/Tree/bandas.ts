import type { ArbolLayout } from '../../lib/arbolLayout'

// Bandas de fondo por año (con la franja de cada cuatrimestre), derivadas de las
// filas REALES del layout: el motor decide las alturas, esto solo las viste.

export interface CuatriMark {
  n: number // 1 | 2
  y: number // top de su franja, relativo a la banda del año
  h: number
}

export interface Banda {
  x: number
  y: number
  width: number
  height: number
  year: number
  alt: boolean
  cuatris: CuatriMark[]
}

const LBL_H = 26 // franja del rótulo "n° cuatrimestre" arriba de cada fila

export function bandasDe(lay: ArbolLayout): Banda[] {
  const porAnio = new Map<number, typeof lay.filas>()
  for (const f of lay.filas) {
    const year = Math.floor(f.cuatri / 2) + 1
    const filas = porAnio.get(year) ?? []
    filas.push(f)
    porAnio.set(year, filas)
  }
  return [...porAnio.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, filas], i) => {
      const top = filas[0].top - LBL_H
      const bottom = filas[filas.length - 1].bottom + 12
      return {
        x: 0,
        y: top,
        width: lay.width,
        height: bottom - top,
        year,
        alt: i % 2 === 1,
        cuatris: filas.map((f) => ({
          n: (f.cuatri % 2) + 1,
          y: f.top - LBL_H - top,
          h: f.bottom - f.top + LBL_H + 8,
        })),
      }
    })
}
