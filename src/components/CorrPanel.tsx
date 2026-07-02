import type { DB } from '../types'
import { plan } from '../domain/Plan'
import { nombreDe } from '../domain/selectors'

interface Props {
  cod: string
  db: DB
  onGoTo: (cod: string) => void
  onVerArbol: (cod: string) => void
}

/** Panel inline de correlativas: dos bloques (Necesitás / Habilita) + atajo al árbol de correlativas. */
export function CorrPanel({ cod, db, onGoTo, onVerArbol }: Props) {
  const antes = plan.antes(cod)
  const despues = plan.despues(cod)
  const vacio = antes.length === 0 && despues.length === 0

  return (
    <div className="corr panel-in">
      {vacio ? (
        <div className="corr-empty">Sin correlativas cargadas.</div>
      ) : (
        <div className="corr-blocks">
          <div className="corr-block need">
            <div className="cb-head">Necesitás antes</div>
            {antes.length > 0 ? (
              <div className="cb-chips">
                {antes.map((c) => (
                  <button key={c} className="chip need" type="button" onClick={() => onGoTo(c)}>
                    {nombreDe(db, c)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="cb-none">Ninguna — se cursa desde el arranque</div>
            )}
          </div>
          <div className="corr-block unlock">
            <div className="cb-head">Habilita después</div>
            {despues.length > 0 ? (
              <div className="cb-chips">
                {despues.map((c) => (
                  <button key={c} className="chip unlock" type="button" onClick={() => onGoTo(c)}>
                    {nombreDe(db, c)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="cb-none">No habilita otras materias</div>
            )}
          </div>
        </div>
      )}
      <button className="corr-tree" type="button" onClick={() => onVerArbol(cod)}>
        ver árbol de correlativas →
      </button>
    </div>
  )
}
