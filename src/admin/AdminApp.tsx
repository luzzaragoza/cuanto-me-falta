// Administración de planes (`#admin`). Chunk aparte y cargado a demanda: no le suma
// un byte al bundle del alumno, igual que el árbol.
//
// Esta primera entrega es de SOLO LECTURA: entrar, saber quién sos, y ver los planes
// que administrás con su estado real (qué versión ve el alumno y si el borrador tiene
// cambios sin publicar). Editar y publicar llegan en la entrega siguiente.

import { useEffect, useState } from 'react'
import { authHabilitado } from '../lib/supabase'
import { Auth, useSession } from '../state/auth'
import { repo, UniversidadAdmin } from '../state/admin'
import { SesionAdmin, type PlanAdmin } from '../lib/admin'
import { EditorPlan } from './EditorPlan'
import { CrearPlan } from './CrearPlan'
import { PanelSuper } from './PanelSuper'
import { Tour } from '../components/Tour'
import { PASOS_LISTA, TOUR_LISTA_KEY, marcarTourVisto, tourVisto } from './tourAdmin'

const volverALaApp = (): void => {
  location.hash = ''
}

const fecha = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AdminApp() {
  const session = useSession()
  const [sesion, setSesion] = useState<SesionAdmin | null>(null)
  const [planes, setPlanes] = useState<PlanAdmin[]>([])
  const [unis, setUnis] = useState<UniversidadAdmin[]>([])
  const [error, setError] = useState<string | null>(null)

  const [intento, setIntento] = useState(0)
  /** Plan abierto en el editor, o `null` si estamos en la lista. */
  const [editando, setEditando] = useState<{ planId: string; uni: string } | null>(null)
  /** Universidad desde la que se está creando un plan, o `null`. */
  const [creando, setCreando] = useState<string | null>(null)
  /** El panel del superadmin (permisos y cupos), abierto o cerrado. */
  const [panelSuper, setPanelSuper] = useState(false)
  const [tourHecho, setTourHecho] = useState(() => tourVisto(TOUR_LISTA_KEY))

  // el perfil se recarga con la sesión: entrar y salir cambian todo lo que se ve
  useEffect(() => {
    if (!session) {
      setSesion(null)
      setPlanes([])
      return
    }
    let vivo = true
    setError(null)
    repo
      .cargarPerfil(session.user.id)
      .then(async (p) => {
        if (!vivo) return
        setSesion(p)
        const [ps, us] = await Promise.all([repo.cargarPlanes(p), repo.cargarUniversidades()])
        if (!vivo) return
        setPlanes(ps)
        setUnis(us)
      })
      .catch((e: unknown) => {
        if (vivo) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      vivo = false
    }
  }, [session, intento])

  const acceso = SesionAdmin.acceso(authHabilitado, session !== null, sesion)
  const nombreUni = (id: string): string => unis.find((u) => u.id === id)?.nombre ?? id
  // El cupo es de la universidad (migración 006). Si todavía no llegó la fila, 0: mejor
  // decir "no entra otro" y que la base desmienta, que ofrecer un botón que va a fallar.
  const limiteUni = (id: string): number => unis.find((u) => u.id === id)?.limite_planes ?? 0

  return (
    <div className="adm">
      {/* Tres niveles y un solo botón: la marca ubica, la identidad se lee si la
          buscás, y "volver a la app" es la única acción con peso. El rol viaja como
          etiqueta con un punto de color — el color dice el privilegio sin gritar. */}
      <header className="adm-head">
        <div className="adm-brand">
          <span className="adm-mark">¿</span>
          <span className="adm-titulo">
            Administración
            <span className="adm-kicker">planes de estudio</span>
          </span>
        </div>

        <div className="adm-acc">
          {session && (
            <div className="adm-quien">
              <span className="adm-mail">{session.user.email}</span>
              <span className="adm-linea2">
                {sesion && (
                  <span className={`adm-rol ${sesion.esSuper ? 'super' : ''}`}>
                    {sesion.esSuper ? 'superadmin' : 'admin'}
                  </span>
                )}
                {/* Un admin de universidad NO ve esto: repartir permisos es lo único
                    exclusivo del superadmin, y ofrecérselo a quien no puede es ofrecerle
                    una puerta que la base le va a cerrar. */}
                {sesion?.puedeGestionarPermisos && !panelSuper && (
                  <button className="adm-salir" onClick={() => setPanelSuper(true)}>
                    Permisos y cupos
                  </button>
                )}
                <button className="adm-salir" onClick={() => void Auth.salir()}>
                  Salir
                </button>
              </span>
            </div>
          )}
          <button className="adm-volver" onClick={volverALaApp}>
            ← Volver a la app
          </button>
        </div>
      </header>

      <main className="adm-main">
        {error && (
          <div className="adm-error">
            <div>
              <strong>No pude leer los datos.</strong> {error}
            </div>
            <button className="lnk" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        )}

        {acceso === 'sin-backend' && (
          <div className="adm-card adm-vacio">
            <h2>Sin backend configurado</h2>
            <p>
              Esta copia de la app corre sin credenciales de Supabase, así que no hay nada que
              administrar. Es lo esperado en desarrollo y en los tests.
            </p>
          </div>
        )}

        {acceso === 'sin-sesion' && (
          <div className="adm-card adm-vacio">
            <h2>Entrá con tu cuenta de administración</h2>
            <p>
              Usá la cuenta habilitada para administrar planes — no la que usás para seguir tu
              propia carrera.
            </p>
            <button className="btn" onClick={() => void Auth.entrarConGoogle()}>
              Entrar con Google
            </button>
          </div>
        )}

        {/* si algo falló, el cartel de error manda: dejar "Cargando…" para siempre
            es la peor pantalla posible (parece que la app se colgó) */}
        {acceso === 'cargando' && !error && <div className="adm-card adm-vacio">Cargando…</div>}

        {acceso === 'sin-permiso' && (
          <div className="adm-card adm-vacio">
            <h2>Esta cuenta no administra planes</h2>
            <p>
              Iniciaste sesión, pero <strong>{session?.user.email}</strong> no tiene permisos de
              administración. Si te corresponden, pedile a quien administra el sistema que te
              habilite para tu universidad.
            </p>
            <button className="lnk" onClick={() => void Auth.salir()}>
              Entrar con otra cuenta
            </button>
          </div>
        )}

        {acceso === 'ok' && sesion && editando && (
          <EditorPlan
            planId={editando.planId}
            puedeEditar={sesion.puedeEditar(editando.uni)}
            onVolver={() => {
              setEditando(null)
              setIntento((n) => n + 1) // la lista se recarga: pudo cambiar la versión publicada
            }}
          />
        )}

        {acceso === 'ok' && sesion?.puedeGestionarPermisos && panelSuper && !editando && (
          <PanelSuper
            universidades={unis}
            planes={planes}
            onCrearPlan={(uni) => {
              setPanelSuper(false)
              setCreando(uni)
            }}
            onCerrar={() => setPanelSuper(false)}
            onCambioLimite={() => setIntento((n) => n + 1)}
          />
        )}

        {acceso === 'ok' && sesion && !editando && !panelSuper && creando !== null && (
          <CrearPlan
            sesion={sesion}
            universidades={unis}
            uniInicial={creando}
            idsExistentes={planes.map((p) => p.id)}
            onCancelar={() => setCreando(null)}
            onCreado={(planId) => {
              setCreando(null)
              setIntento((n) => n + 1) // la lista se recarga con el plan nuevo
              setEditando({ planId, uni: creando })
            }}
          />
        )}

        {acceso === 'ok' && sesion && !editando && creando === null && !panelSuper && (
          <>
            {planes.length === 0 && (
              <div className="adm-card adm-vacio">
                <h2>Todavía no hay planes</h2>
                <p>Cuando cargues el primero, va a aparecer acá.</p>
                {(sesion.esSuper || sesion.universidades.length > 0) && (
                  <button
                    className="btn"
                    onClick={() => setCreando(sesion.universidades[0] ?? unis[0]?.id ?? '')}
                  >
                    Crear el primero
                  </button>
                )}
              </div>
            )}

            {[...new Set(planes.map((p) => p.universidad_id))].map((uni) => {
              const suyos = planes.filter((p) => p.universidad_id === uni)
              const cupo = sesion.cupoEn(uni, suyos.length, limiteUni(uni))
              return (
                <section className="adm-uni" key={uni}>
                  <div className="adm-uni-head">
                    <h2>{nombreUni(uni)}</h2>
                    <span className="adm-cupo">{cupo.leyenda}</span>
                    <button
                      className="adm-nuevo"
                      onClick={() => setCreando(uni)}
                      disabled={!cupo.puedeCrear}
                      title={
                        cupo.puedeCrear
                          ? 'Cargar una carrera nueva'
                          : cupo.leyenda /* dice por qué no se puede */
                      }
                    >
                      + Plan nuevo
                    </button>

                  </div>

                  <ul className="adm-planes">
                    {suyos.map((p) => {
                      const pendiente = p.tieneCambiosSinPublicar
                      return (
                        <li className="adm-plan" key={p.id}>
                          <div className="adm-plan-id">
                            <span className="adm-carrera">{p.carrera}</span>
                            <span className="adm-meta">
                              plan {p.codigo} · {p.anio}
                            </span>
                            {/* El id es PERMANENTE y no se puede cambiar. Tenerlo solo en
                                la base obligaba a abrir Supabase para saber cuál te tocó. */}
                            <code className="adm-id" title="Identificador permanente del plan">
                              {p.id}
                            </code>
                          </div>
                          <div className="adm-plan-estado">
                            <span
                              className={`adm-pill ${p.version_publicada ? 'ok' : 'no'}`}
                              title="Versión que están viendo los alumnos"
                            >
                              {p.etiquetaEstado}
                            </span>
                            {pendiente && (
                              <span
                                className="adm-pill pend"
                                title="El borrador tiene cambios que los alumnos todavía no ven"
                              >
                                Cambios sin publicar
                              </span>
                            )}
                          </div>
                          <div className="adm-plan-fecha">
                            <span className="adm-meta">editado {fecha(p.actualizado_at)}</span>
                          </div>
                          <div className="adm-plan-act">
                            <button
                              className="adm-volver"
                              onClick={() => setEditando({ planId: p.id, uni })}
                            >
                              {sesion.puedeEditar(uni) ? 'Editar' : 'Ver'}
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}

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


          </>
        )}
      </main>
    </div>
  )
}
