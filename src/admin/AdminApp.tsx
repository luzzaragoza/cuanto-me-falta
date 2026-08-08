// Administración de planes (`#admin`). Chunk aparte y cargado a demanda: no le suma
// un byte al bundle del alumno, igual que el árbol.
//
// Esta primera entrega es de SOLO LECTURA: entrar, saber quién sos, y ver los planes
// que administrás con su estado real (qué versión ve el alumno y si el borrador tiene
// cambios sin publicar). Editar y publicar llegan en la entrega siguiente.

import { useEffect, useState } from 'react'
import { authHabilitado } from '../lib/supabase'
import { entrarConGoogle, salir, useSession } from '../state/auth'
import {
  cargarPerfilAdmin,
  cargarPlanesAdmin,
  cargarUniversidades,
  type PlanAdmin,
  type Universidad,
} from '../state/admin'
import {
  cupoDe,
  decidirAcceso,
  esSuper,
  estadoPlan,
  puedeEditar,
  tieneCambiosSinPublicar,
  type PerfilAdmin,
} from '../lib/admin'

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
  const [perfil, setPerfil] = useState<PerfilAdmin | null>(null)
  const [planes, setPlanes] = useState<PlanAdmin[]>([])
  const [unis, setUnis] = useState<Universidad[]>([])
  const [error, setError] = useState<string | null>(null)

  const [intento, setIntento] = useState(0)

  // el perfil se recarga con la sesión: entrar y salir cambian todo lo que se ve
  useEffect(() => {
    if (!session) {
      setPerfil(null)
      setPlanes([])
      return
    }
    let vivo = true
    setError(null)
    cargarPerfilAdmin(session.user.id)
      .then(async (p) => {
        if (!vivo) return
        setPerfil(p)
        const [ps, us] = await Promise.all([cargarPlanesAdmin(p), cargarUniversidades()])
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

  const acceso = decidirAcceso(authHabilitado, session !== null, perfil)
  const nombreUni = (id: string): string => unis.find((u) => u.id === id)?.nombre ?? id

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
                {perfil && (
                  <span className={`adm-rol ${esSuper(perfil) ? 'super' : ''}`}>
                    {esSuper(perfil) ? 'superadmin' : 'admin'}
                  </span>
                )}
                <button className="adm-salir" onClick={() => void salir()}>
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
            <button className="btn" onClick={() => void entrarConGoogle()}>
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
            <button className="lnk" onClick={() => void salir()}>
              Entrar con otra cuenta
            </button>
          </div>
        )}

        {acceso === 'ok' && perfil && (
          <>
            {planes.length === 0 && (
              <div className="adm-card adm-vacio">
                <h2>Todavía no hay planes</h2>
                <p>Cuando cargues el primero, va a aparecer acá.</p>
              </div>
            )}

            {[...new Set(planes.map((p) => p.universidad_id))].map((uni) => {
              const suyos = planes.filter((p) => p.universidad_id === uni)
              const cupo = cupoDe(perfil, uni, suyos.length)
              return (
                <section className="adm-uni" key={uni}>
                  <div className="adm-uni-head">
                    <h2>{nombreUni(uni)}</h2>
                    <span className="adm-cupo">{cupo.leyenda}</span>
                  </div>

                  <ul className="adm-planes">
                    {suyos.map((p) => {
                      const pendiente = tieneCambiosSinPublicar(p.actualizado_at, p.publicado_at)
                      return (
                        <li className="adm-plan" key={p.id}>
                          <div className="adm-plan-id">
                            <span className="adm-carrera">{p.carrera}</span>
                            <span className="adm-meta">
                              plan {p.codigo} · {p.anio}
                            </span>
                          </div>
                          <div className="adm-plan-estado">
                            <span
                              className={`adm-pill ${p.version_publicada ? 'ok' : 'no'}`}
                              title="Versión que están viendo los alumnos"
                            >
                              {estadoPlan(p.estado, p.version_publicada)}
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
                            <button className="btn ghost" disabled title="Llega en la próxima entrega">
                              {puedeEditar(perfil, uni) ? 'Editar' : 'Ver'}
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}

            <p className="adm-nota">
              Los alumnos ven la <strong>versión publicada</strong>. Mientras editás un plan, siguen
              viendo la anterior; al publicar, reciben un aviso y deciden cuándo actualizar.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
