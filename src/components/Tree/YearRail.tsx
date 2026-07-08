import { useViewport } from '@xyflow/react'
import type { Banda } from './layout'

/** Rótulos de año fijados a la izquierda que acompañan el paneo vertical del árbol.
 *  Se renderizan FUERA del viewport transformado (por eso no se van al deslizar) y se
 *  reposicionan leyendo el viewport en vivo. Ver [[layout]]. */
export function YearRail({ bands }: { bands: Banda[] }) {
  const { y, zoom } = useViewport()
  return (
    <div className="tv-rail" aria-hidden="true">
      {bands.map((b) => {
        // centro vertical de la fila de materias (banda +42 = borde sup. de la fila, +~26 = centro)
        const top = y + (b.y + 68) * zoom
        return (
          <div className="tv-rail-item" key={b.year} style={{ top }}>
            <b>{b.year}°</b>
            <span>año</span>
            {b.titulo && <em>{b.titulo.split(' ')[0]}</em>}
          </div>
        )
      })}
    </div>
  )
}
