// Quién puede tocar los planes de una universidad.
//
// Hasta acá, habilitar a alguien era un `insert` corrido a mano en el SQL Editor de
// Supabase. Para vender esto a una facultad, la secretaría académica tiene que poder dar y
// sacar permisos sin llamar a nadie.
//
// SIN MATICES (decisión de Luz, 12-ago): habilitar a alguien en una universidad es darle
// todo ahí adentro —crear, editar, publicar, eliminar— hasta el cupo. Antes había tres
// casillas y lo único que producían era gente habilitada a medias por error, mirando un
// botón apagado sin entender por qué. Lo que sí se reparte es el CUPO, porque es la
// cláusula del contrato. Ver `supabase/010`.
//
// Solo lo ve el superadmin, y solo se llega desde su panel. Las tres operaciones pasan por
// funciones `security definer` (migración 008) porque el mail vive en `auth.users`, que
// PostgREST no expone: el navegador no puede traducir un mail a un `user_id` ni listar el
// padrón de cuentas.
//
// Se habilita POR MAIL y no por id porque el superadmin conoce a la persona por su mail —
// pedirle un UUID sería pedirle que abra el panel de Supabase, que es justo lo que esta
// pantalla viene a evitar.

import { useEffect, useState } from 'react'
import { repo, type AdminHabilitado, type UniversidadAdmin } from '../state/admin'
import { useConfirmar } from '../components/Confirmar'

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
  const [guardando, setGuardando] = useState(false)
  const { pedir, dialogo } = useConfirmar()

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
      await repo.habilitarAdmin({ email, uni: uni.id })
      setEmail('')
      recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  const revocar = (a: AdminHabilitado): void => {
    pedir({
      titulo: '¿Sacarle los permisos?',
      texto: `${a.email} deja de poder tocar los planes de ${uni.nombre}. Tiene efecto inmediato: los permisos se chequean en la base en cada operación, no quedan cacheados en su sesión.`,
      confirmar: 'Sacar los permisos',
      peligro: true,
      onSi: () => {
        setError(null)
        void repo
          .revocarAdmin(a.email, uni.id)
          .then(recargar)
          .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      },
    })
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
      {dialogo}
      <div className="hb-head">
        <div>
          <h2>Permisos y cupo de {uni.nombre}</h2>
          <p className="cp-bajada">
            Quien esté acá puede cargar, editar, publicar y eliminar los planes de esta
            universidad, hasta el cupo.
          </p>
        </div>
        <button className="lnk" onClick={onCerrar}>
          ← Volver a las universidades
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
                <button className="lnk hb-quitar" onClick={() => revocar(a)}>
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
        <p className="cp-ayuda">
          La persona tiene que haber entrado al menos una vez con Google (no se pueden crear
          cuentas desde acá). Queda habilitada para todo en {uni.nombre}; lo que la limita es
          el cupo de arriba.
        </p>
      </div>
    </div>
  )
}
