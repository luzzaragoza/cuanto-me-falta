import { Fragment, useState } from 'react'
import type { DB } from '../types'
import { plan } from '../domain/Plan'
import { avanceDe } from '../domain/Avance'
import { store } from '../state/store'
import { toast } from '../lib/toast'
import { Analytics } from '../lib/analytics'
import { MateriaRow } from './MateriaRow'
import { CorrPanel } from './CorrPanel'

interface Props {
  db: DB
  openCod: string | null
  onOpen: (cod: string, anchor: HTMLElement) => void
  onVerArbol: (cod: string) => void
}

const rowId = (cod: string) => `mat-${cod}`

const IcoCheck = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
const IcoDeshacer = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9h10a5 5 0 0 1 0 10H9" />
    <path d="M7.5 5 3.5 9l4 4" />
  </svg>
)

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

  /** Interruptor de año: aprueba el año entero, o lo deja en blanco si ya lo
   *  estaba. Un solo commit (una escritura, un push) y siempre con "Deshacer",
   *  porque pisa lo que hubiera marcado. */
  const toggleAnio = (year: number) => {
    const cods = plan.codsDelAnio(year)
    const destino = avanceDe(db).decidirAnio(cods)
    const inverso = store.setEstados(Object.fromEntries(cods.map((c) => [c, destino])))
    const av = avanceDe(store.getSnapshot()).conteos
    Analytics.activacion(av.aprobadas + av.final + av.cursando) // suele ser LA activación
    Analytics.evento('anio_marcado')
    const opts = plan.materias().filter((m) => m.year === year).length - cods.length
    const cola = opts > 0 ? ' Las optativas quedan como estaban.' : ''
    toast.show(
      destino === 'aprobada'
        ? `${year}° año: ${cods.length} materias aprobadas.${cola}`
        : `${year}° año: ${cods.length} materias sin marcar.`,
      'info',
      { label: 'Deshacer', run: () => store.setEstados(inverso) },
    )
  }

  // navegar a una materia desde un chip: scroll + flash dorado
  const goTo = (cod: string) => {
    document.getElementById(rowId(cod))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(cod)
    window.setTimeout(() => setFlash((f) => (f === cod ? null : f)), 1100)
  }

  const av0 = avanceDe(db)

  return (
    <div id="plan">
      {plan.anios.map((anio) => {
        const completo = av0.decidirAnio(plan.codsDelAnio(anio.year)) === 'pendiente'
        return (
        <section className="year" key={anio.year}>
          <div className="yhead">
            <span className="n">{anio.year}°</span>
            <span className="l">Año</span>
            <button
              className={'ybtn' + (completo ? ' undo' : '')}
              type="button"
              onClick={() => toggleAnio(anio.year)}
              aria-label={`${completo ? 'Desmarcar' : 'Aprobar'} todas las materias de ${anio.year}° año`}
            >
              {completo ? <IcoDeshacer /> : <IcoCheck />}
              <span>{completo ? 'Desmarcar el año' : 'Aprobar todo el año'}</span>
            </button>
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
                      nom={av0.nombreDe(m.cod)}
                      estado={db.states[m.cod] ?? 'pendiente'}
                      disponible={av0.disponible(m.cod)}
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
        )
      })}
    </div>
  )
}
