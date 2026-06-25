import { useEffect } from 'react'
import { store, useDB } from '../state/store'
import { materiasEnEstado, nombreDe, promedio } from '../domain/selectors'

/** Panel para cargar/editar/borrar la nota de cierre de todas las materias aprobadas. */
export function NotasPanel({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const aprobadas = materiasEnEstado(db, 'aprobada')
  const prom = promedio(db)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal show"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet sheet-wide">
        <div className="notas-top">
          <div>
            <h2>Notas y promedio</h2>
            <p className="m-desc">
              Cargá la nota de cierre de cada materia aprobada. El promedio es <b>sin aplazos</b>.
            </p>
          </div>
          <div className="notas-prom">
            <span className="np-num">{prom.valor ?? '—'}</span>
            <span className="np-cap">
              {prom.valor != null ? `promedio · ${prom.conNota} con nota` : 'promedio'}
            </span>
          </div>
        </div>

        {aprobadas.length === 0 ? (
          <p className="notas-empty">
            Todavía no marcaste materias como <b>aprobadas</b>. Cuando lo hagas, vas a poder cargarles
            la nota acá.
          </p>
        ) : (
          <ul className="notas-list">
            {aprobadas.map((m) => (
              <li className="nota-row" key={m.cod}>
                <span className="nr-cod">{m.cod}</span>
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
                    store.setNota(m.cod, e.target.value === '' ? null : parseFloat(e.target.value))
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <div className="m-actions">
          <button className="btn" onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
