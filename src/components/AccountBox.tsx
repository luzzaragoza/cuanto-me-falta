import { useState } from 'react'
import { authHabilitado } from '../lib/supabase'
import { entrarConGoogle, salir, useSession } from '../state/auth'
import { useSyncEstado } from '../state/sync'

const SYNC_LABEL: Record<string, string> = {
  guardando: 'Sincronizando…',
  listo: 'Sesión iniciada · tu avance se sincroniza',
  error: 'No pude sincronizar — reintento con el próximo cambio',
  conflicto: 'Esperando que elijas qué avance conservar',
  off: 'Sesión iniciada',
}

// Logo "G" oficial de Google (4 colores). Va dentro del botón de ingreso.
const GoogleG = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
)

/**
 * Controles de cuenta (login/logout con Google). Reusable: va en el perfil, en la
 * bienvenida y en el aviso para usuarios existentes. Si no hay backend configurado
 * (`authHabilitado === false`, p.ej. en dev/E2E sin credenciales) no renderiza nada.
 */
export function AccountBox() {
  const session = useSession()
  const sync = useSyncEstado()
  const [cargando, setCargando] = useState(false)

  if (!authHabilitado) return null

  if (session) {
    const u = session.user
    const meta = u.user_metadata as { full_name?: string; name?: string; avatar_url?: string }
    const nombre = meta.full_name || meta.name || u.email || 'Tu cuenta'
    return (
      <div className="acct acct-in">
        <div className="acct-id">
          {meta.avatar_url ? (
            <img className="acct-pic" src={meta.avatar_url} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="acct-pic acct-pic-ph">{nombre.charAt(0).toUpperCase()}</span>
          )}
          <div className="acct-tx">
            <b>{nombre}</b>
            <small className={sync === 'error' ? 'sync-err' : undefined}>{SYNC_LABEL[sync]}</small>
          </div>
        </div>
        <button className="lnk" onClick={() => void salir()}>
          Cerrar sesión
        </button>
      </div>
    )
  }

  return (
    <div className="acct acct-out">
      <button
        className="btn gbtn"
        disabled={cargando}
        onClick={() => {
          setCargando(true)
          void entrarConGoogle()
        }}
      >
        <GoogleG />
        {cargando ? 'Abriendo Google…' : 'Entrar con Google'}
      </button>
      <p className="acct-hint">Sincronizá tu avance entre tus dispositivos.</p>
    </div>
  )
}
