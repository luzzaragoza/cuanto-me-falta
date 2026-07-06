// Analytics agnóstico del proveedor. Hoy usamos Umami; mañana se puede pasar a
// Plausible (u otro) tocando SOLO este archivo — el resto de la app llama `track()`.
//
// Se configura por variables de entorno de Vite (ver .env.example):
//   VITE_ANALYTICS_PROVIDER = 'umami' | 'plausible' | '' (vacío = sin analytics)
//   VITE_UMAMI_SRC, VITE_UMAMI_WEBSITE_ID
//   VITE_PLAUSIBLE_SRC, VITE_PLAUSIBLE_DOMAIN
//
// Privacidad: Umami/Plausible son sin cookies → no hace falta banner de consentimiento.

type Props = Record<string, string | number | boolean>

declare global {
  interface Window {
    umami?: { track: (name: string, data?: Props) => void }
    plausible?: (name: string, opts?: { props?: Props }) => void
  }
}

const env = import.meta.env as Record<string, string | undefined>
const provider = env.VITE_ANALYTICS_PROVIDER ?? ''

function inCliente(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/** ¿Estamos corriendo en local (dev o preview)? No queremos ensuciar las métricas con eso. */
function esLocal(): boolean {
  return (
    inCliente() && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  )
}

/** Inyecta el script del proveedor. Llamar una sola vez, al arrancar la app. */
export function initAnalytics(): void {
  if (!inCliente() || esLocal()) return

  if (provider === 'umami') {
    const src = env.VITE_UMAMI_SRC
    const id = env.VITE_UMAMI_WEBSITE_ID
    if (!src || !id) return
    const s = document.createElement('script')
    s.async = true
    s.defer = true
    s.src = src
    s.setAttribute('data-website-id', id)
    document.head.appendChild(s)
  } else if (provider === 'plausible') {
    const src = env.VITE_PLAUSIBLE_SRC
    const domain = env.VITE_PLAUSIBLE_DOMAIN
    if (!src || !domain) return
    const s = document.createElement('script')
    s.defer = true
    s.src = src
    s.setAttribute('data-domain', domain)
    document.head.appendChild(s)
  }
}

/**
 * Registra un evento custom, agnóstico del proveedor.
 * No-op si no hay analytics configurado. Nunca rompe la UI (envuelto en try/catch).
 * En dev loguea a la consola para poder verificar la instrumentación sin proveedor.
 */
export function track(name: string, data?: Props): void {
  if (import.meta.env.DEV) console.debug('[track]', name, data ?? {})
  if (!inCliente()) return
  try {
    if (provider === 'umami') {
      window.umami?.track(name, data)
    } else if (provider === 'plausible') {
      window.plausible?.(name, data ? { props: data } : undefined)
    }
  } catch {
    // analytics jamás debe tirar abajo la app
  }
}
