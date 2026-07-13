import { useState } from 'react'
import { authHabilitado } from '../lib/supabase'
import { entrarConGoogle, useSession } from '../state/auth'

const DISMISS_KEY = 'cmf-aviso-sync'
const yaDescartado = () => {
  try {
    return !!localStorage.getItem(DISMISS_KEY)
  } catch {
    return false
  }
}

const GoogleG = () => (
  <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
)

/**
 * Aviso una-sola-vez para usuarios que ya venían usando la app (tienen progreso
 * local): les ofrece iniciar sesión para sincronizar. Se descarta y no vuelve.
 * No aparece si no hay backend, si ya hay sesión, o si ya se descartó.
 */
export function SyncAviso() {
  const session = useSession()
  const [oculto, setOculto] = useState(yaDescartado)

  if (!authHabilitado || session || oculto) return null

  const descartar = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* modo incógnito, etc. */
    }
    setOculto(true)
  }

  return (
    <div className="sync-aviso" role="region" aria-label="Sincronización">
      <span className="sa-tx">
        ¿La usás en varios dispositivos? Entrá con tu cuenta y tu avance se sincroniza.
      </span>
      <div className="sa-acts">
        <button className="btn gbtn sa-btn" onClick={() => void entrarConGoogle()}>
          <GoogleG />
          Entrar con Google
        </button>
        <button className="sa-x" aria-label="Descartar" onClick={descartar}>
          ✕
        </button>
      </div>
    </div>
  )
}
