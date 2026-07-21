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
    s.addEventListener('load', flushPendientes) // eventos del arranque, ya con umami vivo
    document.head.appendChild(s)
  } else if (provider === 'plausible') {
    const src = env.VITE_PLAUSIBLE_SRC
    const domain = env.VITE_PLAUSIBLE_DOMAIN
    if (!src || !domain) return
    const s = document.createElement('script')
    s.defer = true
    s.src = src
    s.setAttribute('data-domain', domain)
    s.addEventListener('load', flushPendientes)
    document.head.appendChild(s)
  }
}

// Umami/Plausible se inyectan de forma ASÍNCRONA. Un evento disparado en el
// arranque (pwa_abierta, dia_activo, regreso) llegaba ANTES de que existiera
// `window.umami` → con el `?.` se perdía en silencio (y peor: el flag anti-repetición
// quedaba seteado, así que nunca reintentaba). Solución: si el proveedor todavía no
// cargó, se encola y se vacía en el `load` de su script (flushPendientes).
type Evento = { name: string; data?: Props }
let pendientes: Evento[] = []

/** Intenta emitir YA. Devuelve false si el proveedor todavía no está disponible. */
function emitir(e: Evento): boolean {
  if (provider === 'umami') {
    if (!window.umami) return false
    window.umami.track(e.name, e.data)
    return true
  }
  if (provider === 'plausible') {
    if (!window.plausible) return false
    window.plausible(e.name, e.data ? { props: e.data } : undefined)
    return true
  }
  return true // sin proveedor: no-op ya "entregado", no hay que encolar
}

/** Vacía la cola cuando el script del proveedor terminó de cargar. */
function flushPendientes(): void {
  const cola = pendientes
  pendientes = []
  for (const e of cola) {
    try {
      if (!emitir(e)) pendientes.push(e) // por las dudas: si aún no está, re-encola
    } catch {
      /* noop */
    }
  }
}

/**
 * Registra un evento custom, agnóstico del proveedor.
 * No-op si no hay analytics configurado o si corre en local. Nunca rompe la UI.
 * En dev loguea a la consola para poder verificar la instrumentación sin proveedor.
 */
export function track(name: string, data?: Props): void {
  if (import.meta.env.DEV) console.debug('[track]', name, data ?? {})
  if (!inCliente() || esLocal()) return
  if (provider !== 'umami' && provider !== 'plausible') return
  try {
    const e: Evento = { name, data }
    if (!emitir(e)) pendientes.push(e)
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

/**
 * RETENCIÓN de una app "para entrar a mirar": lo valioso es VOLVER, aunque no se
 * edite nada — mirar "cuánto me falta" o el árbol de correlativas NO cambia el
 * progreso. Por eso `updated_at`/`last_sign_in` subestiman: solo ven ediciones y
 * logins nuevos. Medimos la vuelta con dos eventos, por dispositivo (flags en
 * localStorage, sin backend):
 *  - `dia_activo`: 1 vez por jornada → volumen de días-con-uso (incluye el solo-mirar).
 *  - `regreso`: 1 vez en la vida, cuando quien YA armó su plan (marcó ≥1 materia)
 *    abre en un día POSTERIOR al primero → numerador de retención real.
 * Norte del gate: `regreso ÷ primera_materia` = de los que se enganchan, cuántos vuelven.
 */
export type SesionEstado = {
  primerDia: string | null // cmf-primer-dia: 1ª visita de este dispositivo
  ultimoDia: string | null // cmf-dia: última jornada ya contada
  yaRegreso: boolean // cmf-regreso: el evento 'regreso' ya se disparó
  activada: boolean // cmf-ev-primera: marcó al menos una materia
}
export type SesionDecision = {
  diaActivo: boolean
  regreso: boolean
  nuevoPrimerDia: string | null // valor a persistir (null = no tocar)
  nuevoUltimoDia: string | null
  marcarRegreso: boolean
}

/** Lógica pura. Fechas 'YYYY-MM-DD' → la comparación lexicográfica es cronológica. */
export function decidirSesion(hoy: string, s: SesionEstado): SesionDecision {
  const esAlta = s.primerDia === null
  const primerDia = s.primerDia ?? hoy
  const nuevoDia = s.ultimoDia !== hoy // primera apertura de la jornada
  const regreso = nuevoDia && s.activada && !s.yaRegreso && primerDia < hoy
  return {
    diaActivo: nuevoDia,
    regreso,
    nuevoPrimerDia: esAlta ? hoy : null,
    nuevoUltimoDia: nuevoDia ? hoy : null,
    marcarRegreso: regreso,
  }
}

/** Aplica `decidirSesion` contra localStorage y dispara los eventos. Llamar al arrancar. */
export function trackSesion(): void {
  if (!inCliente()) return
  try {
    const hoy = new Date().toISOString().slice(0, 10)
    const d = decidirSesion(hoy, {
      primerDia: localStorage.getItem('cmf-primer-dia'),
      ultimoDia: localStorage.getItem('cmf-dia'),
      yaRegreso: !!localStorage.getItem('cmf-regreso'),
      activada: !!localStorage.getItem('cmf-ev-primera'),
    })
    if (d.nuevoPrimerDia) localStorage.setItem('cmf-primer-dia', d.nuevoPrimerDia)
    if (d.nuevoUltimoDia) localStorage.setItem('cmf-dia', d.nuevoUltimoDia)
    if (d.marcarRegreso) localStorage.setItem('cmf-regreso', '1')
    if (d.diaActivo) track('dia_activo')
    if (d.regreso) track('regreso')
  } catch {
    /* noop */
  }
}
