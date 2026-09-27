import { useEffect, useState } from 'react'
import type { MateriaUbicada } from '../domain/Plan'
import { store, useDB } from '../state/store'
import { avanceDe } from '../domain/Avance'
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

const NOTAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Drawer lateral para cargar/editar/borrar la nota de cierre de las materias aprobadas. */
export function NotasPanel({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const av = avanceDe(db)
  const aprobadas = av.materiasEn('aprobada')
  const prom = av.promedio
  const { closing, requestClose, onExitEnd } = useExitAnimation(onClose)

  // Filtro y teclado abierto. `pad` guarda el código de la materia que está
  // editándose: solo una a la vez, así el panel no se llena de teclados.
  const [soloSin, setSoloSin] = useState(false)
  const [pad, setPad] = useState<string | null>(null)

  const sinNota = aprobadas.filter((m) => db.notas[m.cod] == null).length
  const visibles = soloSin ? aprobadas.filter((m) => db.notas[m.cod] == null) : aprobadas
  const grupos = porAnio(visibles)
  const promPct = aprobadas.length ? Math.round((prom.conNota / aprobadas.length) * 100) : 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Escape cierra primero el teclado abierto, después el panel: si no, editar
      // una nota y querer salir de ese paso te sacaba de todo.
      if (pad) setPad(null)
      else requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose, pad])

  const ponerNota = (cod: string, n: number | null) => {
    store.setNota(cod, n)
    if (n != null) setPad(null)
  }

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

        {/* La tarjeta del promedio: el número en un disco, y al lado cuántas materias
            lo están sosteniendo. La barra es la MISMA pregunta que el hero pero sobre
            otro dato: cuánto de lo aprobado tiene su nota cargada. */}
        <div className="drawer-prom">
          <span className={'np-disco' + (prom.valor == null ? ' vacio' : '')}>
            <span className="np-num">
              {prom.valor == null ? '—' : prom.valor.toFixed(2).replace('.', ',')}
            </span>
          </span>
          <span className="np-tx">
            <span className="np-cap">promedio</span>
            <span className="np-sub">
              {prom.conNota
                ? `${prom.conNota} de ${aprobadas.length} ${aprobadas.length === 1 ? 'aprobada con nota' : 'aprobadas con nota'}`
                : 'todavía no cargaste ninguna nota'}
            </span>
            <span className="np-bar" role="img" aria-label={`${promPct}% de las aprobadas con nota`}>
              <i style={{ width: `${promPct}%` }} />
            </span>
          </span>
        </div>

        {aprobadas.length > 0 && (
          <div className="np-chips">
            <button
              type="button"
              className={'np-chip' + (soloSin ? '' : ' on')}
              onClick={() => {
                setSoloSin(false)
                setPad(null)
              }}
            >
              Todas
            </button>
            <button
              type="button"
              className={'np-chip' + (soloSin ? ' on' : '')}
              onClick={() => {
                setSoloSin(true)
                setPad(null)
              }}
            >
              Sin nota ({sinNota})
            </button>
          </div>
        )}

        <div className="drawer-body">
          {grupos.length === 0 ? (
            <p className="notas-empty">
              {aprobadas.length === 0 ? (
                <>
                  Todavía no marcaste materias como <b>aprobadas</b>. Cuando lo hagas, vas a poder
                  cargarles la nota acá.
                </>
              ) : (
                'Ya cargaste la nota de todas tus materias aprobadas.'
              )}
            </p>
          ) : (
            grupos.map(([year, mats]) => {
              const todas = aprobadas.filter((m) => m.year === year)
              const conNota = todas.filter((m) => db.notas[m.cod] != null).length
              return (
                <div className="notas-grupo" key={year}>
                  <div className="ng-head">
                    <span className="ng-t">{year}° Año</span>
                    <span className="ng-line" />
                    <span className="ng-meta">
                      {conNota} de {todas.length} con nota
                    </span>
                  </div>
                  <ul className="notas-list">
                    {mats.map((m) => {
                      const v = db.notas[m.cod]
                      const abierto = pad === m.cod
                      return (
                        <li className={'nota-row' + (abierto ? ' abierta' : '')} key={m.cod}>
                          <div className="nr-top">
                            <span className="nr-tx">
                              <span className="nr-cod">
                                {m.cod.startsWith('CUST') ? '—' : m.cod}
                              </span>
                              <span className="nr-nom">{av.nombreDe(m.cod)}</span>
                            </span>
                            {/* Una pastilla, no un <input number>: en el teléfono el
                                campo numérico abre un teclado entero para elegir uno
                                de diez valores. Acá los diez están a un toque. */}
                            <button
                              type="button"
                              className={'nr-pill' + (v != null ? ' con' : '')}
                              aria-expanded={abierto}
                              aria-label={`Nota de ${av.nombreDe(m.cod)}${v != null ? `: ${v}` : ' (sin cargar)'}`}
                              onClick={() => setPad(abierto ? null : m.cod)}
                            >
                              {v ?? '—'}
                            </button>
                          </div>
                          {abierto && (
                            <div className="nr-pad">
                              <div className="nr-teclas">
                                {NOTAS.map((n) => (
                                  <button
                                    key={n}
                                    type="button"
                                    className={'nr-tecla' + (v === n ? ' sel' : '')}
                                    onClick={() => ponerNota(m.cod, n)}
                                  >
                                    {n}
                                  </button>
                                ))}
                              </div>
                              {v != null && (
                                <button
                                  type="button"
                                  className="nr-quitar"
                                  onClick={() => ponerNota(m.cod, null)}
                                >
                                  quitar la nota
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
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
