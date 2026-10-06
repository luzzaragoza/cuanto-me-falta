// El lado institucional (`#admin`). Chunk aparte y cargado a demanda: no le suma un byte
// al bundle del alumno, igual que el árbol.
//
// Cuatro vistas, cada una con su hash para que "atrás" del navegador funcione y un link
// se pueda compartir (diseño de Luz, 28-sep):
//   #admin             inicio: ¿por dónde querés empezar?
//   #admin/planes      el catálogo (y, adentro, el editor y el alta de un plan)
//   #admin/permisos    permisos y cupos — solo el superadmin
//   #admin/resultados  el panel de datos agregados
//
// El editor y el alta de plan NO tienen hash propio: son un trabajo en curso dentro del
// catálogo, y volver "atrás" desde ahí tiene que llevar a la lista, no a media edición.

import { useEffect, useState } from 'react'
import { authHabilitado } from '../lib/supabase'
import { Auth, useSession } from '../state/auth'
import { repo, UniversidadAdmin } from '../state/admin'
import { SesionAdmin, siglaDe, type PlanAdmin } from '../lib/admin'
import { EditorPlan } from './EditorPlan'
import { CrearPlan } from './CrearPlan'
import { PanelSuper } from './PanelSuper'
import { Inicio } from './Inicio'
import { ListaPlanes } from './ListaPlanes'
import { Resultados } from './Resultados'
import { Cabecera, Quien } from './Cabecera'

export type Vista = 'inicio' | 'planes' | 'permisos' | 'resultados'

const volverALaApp = (): void => {
  location.hash = ''
}

/** El nombre de pila que dio Google, si lo dio. */
const nombreDePila = (meta: Record<string, unknown> | undefined): string | null => {
  const n = meta?.full_name ?? meta?.name
  return typeof n === 'string' && n.trim() ? (n.trim().split(/\s+/)[0] ?? null) : null
}

export function AdminApp({ vista = 'inicio' }: { vista?: Vista }) {
  const session = useSession()
  const [sesion, setSesion] = useState<SesionAdmin | null>(null)
  const [planes, setPlanes] = useState<PlanAdmin[]>([])
  const [unis, setUnis] = useState<UniversidadAdmin[]>([])
  const [error, setError] = useState<string | null>(null)

  const [intento, setIntento] = useState(0)
  /** Plan abierto en el editor, o `null` si estamos en la lista. */
  const [editando, setEditando] = useState<{
    planId: string
    uni: string
    publicar: boolean
  } | null>(null)
  /** Universidad desde la que se está creando un plan, o `null`. */
  const [creando, setCreando] = useState<string | null>(null)

  // Cambiar de vista (un link, "atrás") cierra lo que estuviera abierto en el catálogo.
  useEffect(() => {
    setEditando(null)
    setCreando(null)
  }, [vista])

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
  const recargar = (): void => setIntento((n) => n + 1)
  const mail = session?.user.email

  // Las instituciones de quien mira: todas para el superadmin, las suyas para un admin.
  const suyas = sesion?.esSuper ? unis : unis.filter((u) => sesion?.puedeEn(u.id))
  const sigla = !sesion?.esSuper && suyas.length === 1 ? siglaDe(suyas[0]!) : undefined

  // Permisos es solo del superadmin: cualquier otro que llegue por el hash ve el inicio.
  const v: Vista = vista === 'permisos' && !sesion?.puedeGestionarPermisos ? 'inicio' : vista
  const enCatalogo = v === 'planes'

  const aInicio = (
    <a className="adm-volver" href="#admin">
      ← Inicio
    </a>
  )

  // ── la barra de arriba, según la vista ──
  const cabecera =
    acceso !== 'ok' ? (
      <Cabecera titulo="Cuánto me falta" kicker="institucional">
        {session && <Quien mail={mail} sesion={sesion} sigla={sigla} />}
        <button className="adm-volver" onClick={volverALaApp}>
          ← Volver a la app
        </button>
      </Cabecera>
    ) : v === 'inicio' ? (
      <Cabecera titulo="Cuánto me falta" kicker="institucional">
        <Quien mail={mail} sesion={sesion} sigla={sigla} />
      </Cabecera>
    ) : v === 'planes' ? (
      <Cabecera titulo="Administración" kicker="planes de estudio">
        {/* En la lista, quién sos va en el hero (así lo dibujó Luz); en el editor y en el
            alta no hay hero, y vuelve acá arriba. */}
        {(editando || creando !== null) && <Quien mail={mail} sesion={sesion} sigla={sigla} />}
        {aInicio}
      </Cabecera>
    ) : v === 'permisos' ? (
      <Cabecera titulo="Cuánto me falta" kicker="institucional">
        <Quien mail={mail} sesion={sesion} salir={false} />
        {aInicio}
      </Cabecera>
    ) : (
      <Cabecera titulo="Panel institucional" kicker="datos agregados">
        <Quien mail={mail} sesion={sesion} sigla={sigla} />
        {aInicio}
      </Cabecera>
    )

  return (
    <div className="adm">
      {cabecera}

      {error && (
        <div className="adm-main">
          <div className="adm-error">
            <div>
              <strong>No pude leer los datos.</strong> {error}
            </div>
            <button className="lnk" onClick={recargar}>
              Reintentar
            </button>
          </div>
        </div>
      )}

      {acceso === 'sin-backend' && (
        <div className="adm-main">
          <div className="adm-card adm-vacio">
            <h2>Sin backend configurado</h2>
            <p>
              Esta copia de la app corre sin credenciales de Supabase, así que no hay nada que
              administrar. Es lo esperado en desarrollo y en los tests.
            </p>
          </div>
        </div>
      )}

      {acceso === 'sin-sesion' && (
        <div className="adm-main">
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
        </div>
      )}

      {/* si algo falló, el cartel de error manda: dejar "Cargando…" para siempre
          es la peor pantalla posible (parece que la app se colgó) */}
      {acceso === 'cargando' && !error && (
        <div className="adm-main">
          <div className="adm-card adm-vacio">Cargando…</div>
        </div>
      )}

      {acceso === 'sin-permiso' && (
        <div className="adm-main">
          <div className="adm-card adm-vacio">
            <h2>Esta cuenta no administra planes</h2>
            <p>
              Iniciaste sesión, pero <strong>{mail}</strong> no tiene permisos de administración.
              Si te corresponden, pedile a quien administra el sistema que te habilite para tu
              universidad.
            </p>
            <button className="lnk" onClick={() => void Auth.salir()}>
              Entrar con otra cuenta
            </button>
          </div>
        </div>
      )}

      {acceso === 'ok' && sesion && (
        <>
          {v === 'inicio' && (
            <Inicio
              sesion={sesion}
              alcance={
                sesion.esSuper
                  ? `${unis.length} ${unis.length === 1 ? 'institución' : 'instituciones'}`
                  : suyas.map((u) => siglaDe(u)).join(' · ')
              }
              nombre={nombreDePila(session?.user.user_metadata)}
            />
          )}

          {v === 'resultados' && <Resultados />}

          {v === 'permisos' && (
            <PanelSuper universidades={unis} planes={planes} onCambio={recargar} />
          )}

          {enCatalogo && editando && (
            <div className="adm-main">
              <EditorPlan
                planId={editando.planId}
                puedeEditar={sesion.puedeEditar(editando.uni)}
                abrirPublicar={editando.publicar}
                onVolver={() => {
                  setEditando(null)
                  recargar() // la lista se recarga: pudo cambiar la versión publicada
                }}
              />
            </div>
          )}

          {enCatalogo && !editando && creando !== null && (
            <div className="adm-main">
              <CrearPlan
                sesion={sesion}
                universidades={unis}
                uniInicial={creando}
                idsExistentes={planes.map((p) => p.id)}
                onCancelar={() => setCreando(null)}
                onCreado={(planId) => {
                  setCreando(null)
                  recargar() // la lista se recarga con el plan nuevo
                  setEditando({ planId, uni: creando, publicar: false })
                }}
              />
            </div>
          )}

          {enCatalogo && !editando && creando === null && (
            <ListaPlanes
              sesion={sesion}
              mail={mail}
              planes={planes}
              unis={unis}
              onEditar={(planId, uni, publicar) => setEditando({ planId, uni, publicar })}
              onCrear={(uni) => setCreando(uni)}
            />
          )}
        </>
      )}
    </div>
  )
}
