import { useState } from 'react'
import { authHabilitado } from '../lib/supabase'
import { useSession } from '../state/auth'

const DISMISS_KEY = 'cmf-aviso-ios'
const SYNC_DISMISS_KEY = 'cmf-aviso-sync' // el aviso de sync tiene prioridad

const flag = (k: string) => {
  try {
    return !!localStorage.getItem(k)
  } catch {
    return true
  }
}

/** iPhone/iPad (el iPad moderno se reporta como Mac con touch). */
function esIOS(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** ¿Ya corre instalada (agregada a inicio)? Ahí el aviso no tiene sentido. */
function instalada(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

// Ícono "compartir" de iOS (cuadrado con flecha para arriba), para que se
// reconozca QUÉ botón tocar en Safari.
const IconShare = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v13" />
    <path d="M8 7l4-4 4 4" />
    <path d="M8 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" />
  </svg>
)

/**
 * Banner una-sola-vez para usuarios de iOS en el navegador: Safari no ofrece
 * instalar PWAs por su cuenta, así que se lo contamos nosotros. No aparece si ya
 * está instalada, si se descartó, o mientras el aviso de sync esté pendiente
 * (nunca dos banners apilados). 41% de los usuarios son iOS — vale la franja.
 */
export function InstallAviso() {
  const session = useSession()
  const [oculto, setOculto] = useState(() => flag(DISMISS_KEY))

  // el aviso de sync va primero: si todavía puede aparecer, este espera
  const syncPendiente = authHabilitado && !session && !flag(SYNC_DISMISS_KEY)

  if (oculto || syncPendiente || !esIOS() || instalada()) return null

  const descartar = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* noop */
    }
    setOculto(true)
  }

  return (
    <div className="sync-aviso ios-aviso" role="region" aria-label="Instalar la app">
      <span className="sa-tx">
        <b>Llevá la app en tu iPhone:</b> tocá compartir{' '}
        <span className="sa-ic">
          <IconShare />
        </span>{' '}
        y elegí <b>“Agregar a inicio”</b>. Queda con su ícono y anda sin conexión.
      </span>
      <div className="sa-acts">
        <button className="sa-x" aria-label="Descartar" onClick={descartar}>
          ✕
        </button>
      </div>
    </div>
  )
}
