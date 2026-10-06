// "¿Cómo van mis planes?" — la lista del catálogo (diseño de Luz, 28-sep).
//
// Arriba, el panorama en tres números (cargados · publicados · sin publicar) y una frase
// que los dice en castellano. Abajo, una tarjeta por plan con la única pregunta que
// importa al mirarla: ¿qué versión ven los alumnos, y le quedó algo sin publicar?
//
// El botón de cada fila cambia según esa respuesta: si hay cambios pendientes, lo que
// toca es "Revisar y publicar" (y abre el editor con el panel de publicar ya abierto);
// si está al día, "Editar". Un solo botón, el que corresponde.

import { useState } from 'react'
import {
  fechaCorta,
  ResumenPlanes,
  siglaDe,
  type PlanAdmin,
  type SesionAdmin,
} from '../lib/admin'
import type { UniversidadAdmin } from '../state/admin'
import { Quien } from './Cabecera'
import { Tour } from '../components/Tour'
import { PASOS_LISTA, TOUR_LISTA_KEY, marcarTourVisto, tourVisto } from './tourAdmin'

export function ListaPlanes({
  sesion,
  mail,
  planes,
  unis,
  onEditar,
  onCrear,
}: {
  sesion: SesionAdmin
  mail: string | undefined
  planes: PlanAdmin[]
  unis: UniversidadAdmin[]
  /** `publicar`: abrir el editor con el panel de revisar y publicar ya abierto. */
  onEditar: (planId: string, uni: string, publicar: boolean) => void
  onCrear: (uni: string) => void
}) {
  const [soloPend, setSoloPend] = useState(false)
  const [tourHecho, setTourHecho] = useState(() => tourVisto(TOUR_LISTA_KEY))

  // Las universidades que se muestran: todas para el superadmin, las suyas para un
  // admin. Una universidad sin planes TAMBIÉN va: es donde está el "+ Plan nuevo".
  const visibles = sesion.esSuper ? unis : unis.filter((u) => sesion.puedeEn(u.id))
  const r = ResumenPlanes.de(planes)
  const donde =
    visibles.length === 1
      ? ResumenPlanes.dondeUna(visibles[0]!.nombre, r.total)
      : ResumenPlanes.dondeVarias(r.total, visibles.length)

  return (
    <main className="adm-scroll">
      <section className="lp-hero">
        <span className="lp-deco d1" />
        <span className="lp-deco d2" />
        <span className="lp-deco d3" />
        <div className="lp-hero-in">
          <Quien
            mail={mail}
            sesion={sesion}
            sigla={visibles.length === 1 ? siglaDe(visibles[0]!) : undefined}
          >
            {sesion.puedeGestionarPermisos && (
              <a className="adm-salir fuerte" href="#admin/permisos">
                Permisos y cupos
              </a>
            )}
          </Quien>
          <h1 className="lp-titulo">Planes de estudio</h1>
          <p className="lp-frase">{r.frase(donde)}</p>

          <div className="lp-cuentas">
            <div className="lp-cuenta">
              <span className="n">{r.total}</span>
              <span className="l">cargados</span>
            </div>
            <div className="lp-cuenta ok">
              <span className="n">{r.publicados}</span>
              <span className="l">publicados</span>
            </div>
            <div className="lp-cuenta pend">
              <span className="n">{r.pendientes}</span>
              <span className="l">sin publicar</span>
            </div>
            <p className="lp-nota">Los alumnos ven solo la última versión publicada de cada plan.</p>
          </div>
        </div>
      </section>

      {planes.length === 0 ? (
        <div className="lp-cuerpo">
          <div className="lp-vacio">
            <span className="lp-vacio-deco" />
            <span className="lp-vacio-mark">¿</span>
            <h2>Todavía no hay planes</h2>
            <p>
              Cuando cargues el primero va a aparecer acá, con la versión que ven los alumnos y si
              te quedaron cambios sin publicar.
            </p>
            {visibles.length > 0 && (
              <button className="lp-primario grande" onClick={() => onCrear(visibles[0]!.id)}>
                Crear el primero
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="lp-cuerpo">
          <div className="lp-filtro">
            <span className="lp-filtro-lbl">mostrar</span>
            <div className="lp-seg" role="group" aria-label="Qué planes mostrar">
              <button className={soloPend ? '' : 'on'} onClick={() => setSoloPend(false)}>
                Todos ({r.total})
              </button>
              <button className={soloPend ? 'on' : ''} onClick={() => setSoloPend(true)}>
                Con cambios sin publicar ({r.pendientes})
              </button>
            </div>
          </div>

          {visibles.map((u) => {
            const suyos = planes.filter((p) => p.universidad_id === u.id)
            const lista = soloPend ? suyos.filter((p) => p.tieneCambiosSinPublicar) : suyos
            const cupo = sesion.cupoEn(u.id, suyos.length, u.limite_planes)
            return (
              <section className="adm-uni" key={u.id}>
                <div className="adm-uni-head">
                  <span className="lp-sigla">{siglaDe(u)}</span>
                  <div className="lp-uni-id">
                    <h2>{u.nombre}</h2>
                    <div className="lp-uni-cupo">
                      <span>{cupo.leyenda}</span>
                      {cupo.limite !== null && (
                        <span className="lp-puntos" aria-hidden="true">
                          {Array.from({ length: cupo.limite }, (_, i) => (
                            <span key={i} className={i < cupo.usados ? 'lleno' : ''} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="adm-nuevo lp-primario"
                    onClick={() => onCrear(u.id)}
                    disabled={!cupo.puedeCrear}
                    title={cupo.puedeCrear ? 'Cargar una carrera nueva' : cupo.leyenda}
                  >
                    + Plan nuevo
                  </button>
                </div>

                <ul className="adm-planes">
                  {lista.map((p) => {
                    const pend = p.tieneCambiosSinPublicar
                    const puede = sesion.puedeEditar(u.id)
                    return (
                      <li className="adm-plan" key={p.id}>
                        {p.visible ? (
                          <span className="lp-ver">v{p.version_publicada}</span>
                        ) : (
                          <span className="lp-ver no">–</span>
                        )}
                        <div className="adm-plan-id">
                          <span className="adm-carrera">{p.carrera}</span>
                          <span className="lp-meta">
                            <span>
                              plan {p.codigo} · {p.anio}
                            </span>
                            {/* El id es PERMANENTE y no se puede cambiar. Tenerlo solo en
                                la base obligaba a abrir Supabase para saber cuál te tocó. */}
                            <code className="adm-id" title="Identificador permanente del plan">
                              {p.id}
                            </code>
                            <span>editado {fechaCorta(p.actualizado_at)}</span>
                          </span>
                        </div>
                        <div className="adm-plan-estado">
                          {p.visible ? (
                            <span className="adm-pill ok" title="Versión que están viendo los alumnos">
                              {p.etiquetaEstado}
                            </span>
                          ) : (
                            <span
                              className="adm-pill no"
                              title="Los alumnos todavía no ven ninguna versión de este plan"
                            >
                              Sin publicar
                            </span>
                          )}
                          {pend && (
                            <span
                              className="adm-pill pend"
                              title="El borrador tiene cambios que los alumnos todavía no ven"
                            >
                              Cambios sin publicar
                            </span>
                          )}
                        </div>
                        <div className="adm-plan-act">
                          {pend && puede ? (
                            <button
                              className="lp-primario chico"
                              onClick={() => onEditar(p.id, u.id, true)}
                            >
                              Revisar y publicar
                            </button>
                          ) : (
                            <button
                              className="lp-secundario"
                              onClick={() => onEditar(p.id, u.id, false)}
                            >
                              {puede ? 'Editar' : 'Ver'}
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {lista.length === 0 && (
                  <p className="lp-vacio-filtro">
                    {soloPend
                      ? `Ningún plan de ${u.nombre} tiene cambios sin publicar.`
                      : `${u.nombre} todavía no tiene planes.`}
                  </p>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* El tour corre una sola vez y recién con la lista PINTADA: sus pasos apuntan a
          elementos reales, y si no existen todavía no hay nada que resaltar. */}
      {!tourHecho && planes.length > 0 && (
        <Tour
          pasos={PASOS_LISTA}
          onClose={() => {
            marcarTourVisto(TOUR_LISTA_KEY)
            setTourHecho(true)
          }}
        />
      )}
    </main>
  )
}
