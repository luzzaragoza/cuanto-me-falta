import { useEffect } from 'react'
import type { MateriaUbicada } from '../domain/Plan'
import { store, useDB } from '../state/store'
import { materiasEnEstado, nombreDe, promedio } from '../domain/selectors'
import { useExitAnimation } from '../hooks/useExitAnimation'

/** Agrupa las aprobadas por año, ordenadas por año ascendente. */
function porAnio(mats: MateriaUbicada[]): [number, MateriaUbicada[]][] {
  const map = new Map<number, MateriaUbicada[]>()
  for (const m of mats) {
    const arr = map.get(m.year) ?? []
    arr.push(m)
    map.set(m.year, arr)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0])
}

/** Drawer lateral para cargar/editar/borrar la nota de cierre de las materias aprobadas. */
export function NotasPanel({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const aprobadas = materiasEnEstado(db, 'aprobada')
  const grupos = porAnio(aprobadas)
  const prom = promedio(db)
  const { closing, requestClose, onExitEnd } = useExitAnimation(onClose)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose])

  return (
    <div
      className={`drawer-wrap${closing ? ' closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <aside className="drawer" onAnimationEnd={onExitEnd}>
        <div className="drawer-head">
          <div>
            <h2>Notas</h2>
            <p className="m-desc">
              Nota de cierre de cada materia aprobada. El promedio es <b>sin aplazos</b>.
            </p>
          </div>
          <button className="tv-close" type="button" onClick={requestClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="drawer-prom">
          <span className="np-num">{prom.valor ?? '—'}</span>
          <span className="np-cap">
            {prom.valor != null
              ? `promedio · ${prom.conNota} ${prom.conNota === 1 ? 'materia con nota' : 'materias con nota'}`
              : 'promedio'}
          </span>
        </div>

        <div className="drawer-body">
          {aprobadas.length === 0 ? (
            <p className="notas-empty">
              Todavía no marcaste materias como <b>aprobadas</b>. Cuando lo hagas, vas a poder
              cargarles la nota acá.
            </p>
          ) : (
            grupos.map(([year, mats]) => (
              <div className="notas-grupo" key={year}>
                <div className="ng-head">{year}° Año</div>
                <ul className="notas-list">
                  {mats.map((m) => (
                    <li className="nota-row" key={m.cod}>
                      <span className="nr-cod">{m.cod.startsWith('CUST') ? '—' : m.cod}</span>
                      <span className="nr-nom">{nombreDe(db, m.cod)}</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        inputMode="numeric"
                        placeholder="—"
                        value={db.notas[m.cod] ?? ''}
                        onChange={(e) =>
                          store.setNota(
                            m.cod,
                            e.target.value === '' ? null : parseFloat(e.target.value),
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="drawer-foot">
          <button className="btn" type="button" onClick={requestClose}>
            Listo
          </button>
        </div>
      </aside>
    </div>
  )
}
