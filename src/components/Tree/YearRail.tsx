import { useViewport } from '@xyflow/react'
import type { Banda } from './bandas'

/** Rótulos de año fijados a la izquierda que acompañan el paneo vertical del árbol.
 *  Se renderizan FUERA del viewport transformado (por eso no se van al deslizar) y se
 *  reposicionan leyendo el viewport en vivo. Ver [[layout]]. */
export function YearRail({ bands }: { bands: Banda[] }) {
  const { y, zoom } = useViewport()
  return (
    <div className="tv-rail" aria-hidden="true">
      {bands.map((b) => {
        // centrado vertical en la banda del año (que ahora abarca sus dos filas)
        const top = y + (b.y + b.height / 2) * zoom
        return (
          <div className="tv-rail-item" key={b.year} style={{ top }}>
            <b>{b.year}°</b>
            <span>año</span>
          </div>
        )
      })}
    </div>
  )
}
