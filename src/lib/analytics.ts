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

/** ¿La URL trae restos del redirect de OAuth? (credenciales, no las queremos en métricas) */
function urlConAuth(): boolean {
  return /[?&#](code|access_token|error_description)=/.test(location.search + location.hash)
}

/** Inyecta el script del proveedor. Llamar una sola vez, al arrancar la app. */
export function initAnalytics(): void {
  if (!inCliente() || esLocal()) return

  // Aterrizando de un redirect de OAuth, la pageview inicial registraría la URL
  // con credenciales (?code= de PKCE). auth.ts la limpia apenas resuelve la
  // sesión → se espera esa limpieza y recién ahí se inyecta el script. Tope de
  // ~4s por si algo falla: mejor una fila fea que perder la visita.
  if (urlConAuth()) {
    let intentos = 0
    const timer = setInterval(() => {
      if (!urlConAuth() || ++intentos >= 13) {
        clearInterval(timer)
        inyectarScript()
      }
    }, 300)
    return
  }
  inyectarScript()
}

function inyectarScript(): void {
  if (provider === 'umami') {
    const src = env.VITE_UMAMI_SRC
    const id = env.VITE_UMAMI_WEBSITE_ID
    if (!src || !id) return
    const s = document.createElement('script')
    s.async = true
    s.defer = true
    s.src = src
    s.setAttribute('data-website-id', id)
    // El hash nunca aporta a las métricas (no hay hash-routing) y era por donde
    // se colaba el token de OAuth. OJO: NO agregar `data-exclude-search` — el
    // tracker borra TODOS los query params, utm_* incluidos (verificado contra
    // el script de cloud.umami.is), y mataría la atribución de campañas.
    s.setAttribute('data-exclude-hash', 'true')
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

/**
 * Hitos de ACTIVACIÓN (la métrica que alimenta el Gate A). Se disparan una sola vez
 * por usuario, con un flag en localStorage: la 1ª materia que marca, y cuando llega a 5
 * (el umbral de "activado" del plan comercial). `marcadas` = materias no-pendientes.
 */
export function trackActivacion(marcadas: number): void {
  if (!inCliente()) return
  try {
    if (marcadas >= 1 && !localStorage.getItem('cmf-ev-primera')) {
      localStorage.setItem('cmf-ev-primera', '1')
      track('primera_materia')
    }
    if (marcadas >= 5 && !localStorage.getItem('cmf-ev-activado')) {
      localStorage.setItem('cmf-ev-activado', '1')
      track('activado')
    }
  } catch {
    /* noop */
  }
}

/**
 * Señales de instalación como app (PWA) — las dos que existen:
 * - `pwa_instalada`: el navegador confirma que se instaló (evento `appinstalled`,
 *   solo Chromium: Android y desktop). iOS no lo emite nunca.
 * - `pwa_abierta`: primera vez POR DISPOSITIVO que la app corre instalada
 *   (standalone). Es la única señal observable en iOS; en Android además mide
 *   quién, aparte de instalarla, la abre. La diferencia entre ambas = instalan
 *   pero no vuelven.
 */
export function trackPwa(): void {
  if (!inCliente()) return
  try {
    window.addEventListener('appinstalled', () => track('pwa_instalada'))
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (standalone && !localStorage.getItem('cmf-ev-pwa')) {
      localStorage.setItem('cmf-ev-pwa', '1')
      track('pwa_abierta')
    }
  } catch {
    /* noop */
  }
}
