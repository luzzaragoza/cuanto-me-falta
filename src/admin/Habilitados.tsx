// Quién puede tocar los planes de una universidad, y con qué permisos.
//
// Es el paso 4 del sprint: hasta ahora habilitar a alguien era un `insert` corrido a mano
// en el SQL Editor de Supabase. Para vender esto a una facultad, la secretaría académica
// tiene que poder dar y sacar permisos sin llamar a nadie.
//
// Solo lo ve el superadmin. Y las tres operaciones pasan por funciones `security definer`
// (migración 008) porque el mail vive en `auth.users`, que PostgREST no expone: el
// navegador no puede traducir un mail a un `user_id`, ni listar el padrón de cuentas.
//
// Se habilita POR MAIL y no por id porque el superadmin conoce a la persona por su mail —
// pedirle un UUID sería pedirle que abra el panel de Supabase, que es justo lo que esta
// pantalla viene a evitar.

import { useEffect, useState } from 'react'
import { repo, type AdminHabilitado, type UniversidadAdmin } from '../state/admin'

export function Habilitados({
  uni,
  onCerrar,
  onCambioLimite,
}: {
  uni: UniversidadAdmin
  onCerrar: () => void
  /** Para que la lista de planes refresque el cupo sin recargar todo. */
  onCambioLimite: () => void
}) {
  const [admins, setAdmins] = useState<AdminHabilitado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [crear, setCrear] = useState(false)
  const [editar, setEditar] = useState(true)
  const [eliminar, setEliminar] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [limite, setLimite] = useState(String(uni.limite_planes))

  const recargar = (): void => {
    setCargando(true)
    repo
      .cargarAdmins(uni.id)
      .then((a) => {
        setAdmins(a)
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setCargando(false))
  }

  useEffect(recargar, [uni.id])

  const habilitar = async (): Promise<void> => {
    setGuardando(true)
    setError(null)
    try {
      await repo.habilitarAdmin({ email, uni: uni.id, crear, editar, eliminar })
      setEmail('')
      recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  const revocar = async (a: AdminHabilitado): Promise<void> => {
    if (!confirm(`¿Sacarle los permisos a ${a.email}? Tiene efecto inmediato.`)) return
    setError(null)
    try {
      await repo.revocarAdmin(a.email, uni.id)
      recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const guardarLimite = async (): Promise<void> => {
    const n = Number(limite)
    if (!Number.isInteger(n) || n < 0) return
    if (n === uni.limite_planes) return
    setError(null)
    try {
      await repo.guardarLimite(uni.id, n)
      onCambioLimite()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="adm-card hb">
      <div className="hb-head">
        <div>
          <h2>Permisos de {uni.nombre}</h2>
          <p className="cp-bajada">
            Quién puede cargar y publicar planes de esta universidad.
          </p>
        </div>
        <button className="lnk" onClick={onCerrar}>
          ← Volver a los planes
        </button>
      </div>

      {/* El cupo es del contrato con la facultad, no del admin: vive con la universidad. */}
      <label className="hb-limite">
        <span className="cp-lbl">Planes que puede tener esta universidad</span>
        <span className="hb-limite-in">
          <input
            className="cp-in cp-in-num"
            type="number"
            min={0}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            onBlur={() => void guardarLimite()}
            aria-label="Límite de planes de la universidad"
          />
          <span className="cp-ayuda">Lo que diga el contrato. Se guarda al salir del campo.</span>
        </span>
      </label>

      {error && (
        <div className="adm-error">
          <div>{error}</div>
        </div>
      )}

      <div className="hb-lista">
        <div className="cp-lbl">Habilitados</div>
        {cargando ? (
          <p className="adm-meta">Cargando…</p>
        ) : admins.length === 0 ? (
          <p className="adm-meta">
            Nadie todavía. Vos podés igual: el superadmin puede en todas las universidades.
          </p>
        ) : (
          <ul className="hb-admins">
            {admins.map((a) => (
              <li className="hb-admin" key={a.user_id}>
                <span className="hb-mail">{a.email}</span>
                <span className="hb-permisos">{a.resumen}</span>
                <button className="lnk hb-quitar" onClick={() => void revocar(a)}>
                  quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hb-alta">
        <div className="cp-lbl">Habilitar a alguien</div>
        <div className="hb-alta-fila">
          <input
            className="cp-in"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@universidad.edu.ar"
            aria-label="Mail de la persona a habilitar"
          />
          <button
            className="btn"
            onClick={() => void habilitar()}
            disabled={!email.trim() || guardando}
          >
            {guardando ? 'Habilitando…' : 'Habilitar'}
          </button>
        </div>
        <div className="hb-checks">
          <label>
            <input type="checkbox" checked={editar} onChange={(e) => setEditar(e.target.checked)} />
            Editar y publicar planes
          </label>
          <label>
            <input type="checkbox" checked={crear} onChange={(e) => setCrear(e.target.checked)} />
            Crear planes nuevos
          </label>
          <label>
            <input
              type="checkbox"
              checked={eliminar}
              onChange={(e) => setEliminar(e.target.checked)}
            />
            Eliminar planes
          </label>
        </div>
        <p className="cp-ayuda">
          La persona tiene que haber entrado al menos una vez con Google. No se pueden crear
          cuentas desde acá.
        </p>
      </div>
    </div>
  )
}
