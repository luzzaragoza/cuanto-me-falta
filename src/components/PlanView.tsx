import { Fragment, useState } from 'react'
import type { DB } from '../types'
import { plan } from '../domain/Plan'
import { disponible, nombreDe } from '../domain/selectors'
import { MateriaRow } from './MateriaRow'
import { CorrPanel } from './CorrPanel'

interface Props {
  db: DB
  openCod: string | null
  onOpen: (cod: string, anchor: HTMLElement) => void
  onVerArbol: (cod: string) => void
}

const rowId = (cod: string) => `mat-${cod}`

/** Banda de hito: el título que se obtiene al completar las materias que tiene arriba.
 *  Va al pie del año (o del cuatrimestre, si el hito cae a mitad de año), no en el
 *  encabezado: pedido de los usuarios del soft-launch. */
function TituloHito({ nombre }: { nombre: string }) {
  return (
    <div className="titulo-hito">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 1 8l11 5 9-4.09V15h2V8z" />
        <path d="M5 11.18V15c0 1.66 3.13 3 7 3s7-1.34 7-3v-3.82l-7 3.18z" />
      </svg>
      <span className="th-tx">
        <span className="th-k">Título</span>
        <span className="th-n">{nombre}</span>
      </span>
    </div>
  )
}

export function PlanView({ db, openCod, onOpen, onVerArbol }: Props) {
  const [corr, setCorr] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)

  const toggleCorr = (cod: string) =>
    setCorr((prev) => {
      const next = new Set(prev)
      if (next.has(cod)) next.delete(cod)
      else next.add(cod)
      return next
    })

  // navegar a una materia desde un chip: scroll + flash dorado
  const goTo = (cod: string) => {
    document.getElementById(rowId(cod))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(cod)
    window.setTimeout(() => setFlash((f) => (f === cod ? null : f)), 1100)
  }

  return (
    <div id="plan">
      {plan.anios.map((anio) => (
        <section className="year" key={anio.year}>
          <div className="yhead">
            <span className="n">{anio.year}°</span>
            <span className="l">Año</span>
          </div>
          <div className="cuatris">
            {anio.cuatris.map((q) => (
              <div className="cuati" key={q.n}>
                <h3>{q.n}° Cuatrimestre</h3>
                {q.mats.map((m) => (
                  <Fragment key={m.cod}>
                    <MateriaRow
                      id={rowId(m.cod)}
                      cod={m.cod}
                      nom={nombreDe(db, m.cod)}
                      estado={db.states[m.cod] ?? 'pendiente'}
                      disponible={disponible(db, m.cod)}
                      abierto={openCod === m.cod}
                      flash={flash === m.cod}
                      corrAbierto={corr.has(m.cod)}
                      onOpen={(anchor) => onOpen(m.cod, anchor)}
                      onToggleCorr={() => toggleCorr(m.cod)}
                    />
                    {corr.has(m.cod) && (
                      <CorrPanel cod={m.cod} db={db} onGoTo={goTo} onVerArbol={onVerArbol} />
                    )}
                  </Fragment>
                ))}
                {q.titulo && <TituloHito nombre={q.titulo} />}
              </div>
            ))}
          </div>
          {anio.titulo && <TituloHito nombre={anio.titulo} />}
        </section>
      ))}
    </div>
  )
}
