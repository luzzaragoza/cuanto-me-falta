import type { DB } from '../types'
import { PLAN } from '../data/plan'
import { disponible, nombreDe } from '../domain/selectors'
import { MateriaRow } from './MateriaRow'

interface Props {
  db: DB
  openCod: string | null
  onOpen: (cod: string, anchor: HTMLElement) => void
}

export function PlanView({ db, openCod, onOpen }: Props) {
  return (
    <div id="plan">
      {PLAN.map((anio) => (
        <section className="year" key={anio.year}>
          <div className="yhead">
            <span className="n">{anio.year}°</span>
            <span className="l">Año</span>
            {anio.titulo && <span className="badge">→ {anio.titulo}</span>}
          </div>
          <div className="cuatris">
            {anio.cuatris.map((q) => (
              <div className="cuati" key={q.n}>
                <h3>{q.n}° Cuatrimestre</h3>
                {q.mats.map((m) => (
                  <MateriaRow
                    key={m.cod}
                    cod={m.cod}
                    nom={nombreDe(db, m.cod)}
                    estado={db.states[m.cod] ?? 'pendiente'}
                    disponible={disponible(db, m.cod)}
                    abierto={openCod === m.cod}
                    onOpen={(anchor) => onOpen(m.cod, anchor)}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
