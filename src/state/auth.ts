// Sesión de Supabase como store observable, mismo patrón que `useDB()`:
// un valor + listeners + `useSyncExternalStore`. La UI llama `useSession()` y se
// re-renderiza cuando cambia el login. Si no hay backend (`supabase === null`),
// la sesión es siempre `null` y las acciones son no-op.

import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

let session: Session | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/**
 * Tras el redirect de OAuth quedan credenciales en la URL (`?code=` con PKCE,
 * `#access_token=` en el flujo viejo, `?error=` si canceló). Para cuando llega
 * cualquier evento de auth el cliente ya las consumió → se sacan de la barra:
 * no van al historial ni a las métricas (analytics espera esta limpieza antes
 * de inyectar su script al aterrizar de un redirect).
 */
function limpiarUrlAuth(): void {
  const resto = location.search + location.hash
  if (!/[?&#](code|access_token|error|error_description)=/.test(resto)) return
  // El hash se CONSERVA si no es basura de OAuth: es la ruta de la app
  // (`#admin`), así que volver de Google tiene que dejarte donde estabas.
  const hash = /(access_token|error)=/.test(location.hash) ? '' : location.hash
  history.replaceState(history.state, '', location.pathname + hash)
}

if (supabase) {
  // sesión inicial (si el usuario ya estaba logueado) + cambios (login/logout,
  // y el canje del code cuando Google redirige de vuelta a la app)
  supabase.auth.getSession().then(({ data }) => {
    session = data.session
    emit()
  })
  supabase.auth.onAuthStateChange((_evento, nueva) => {
    limpiarUrlAuth()
    session = nueva
    emit()
  })
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): Session | null {
  return session
}

/** Hook: la sesión actual (o `null` si no hay login / no hay backend). */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

/**
 * Dispara el flujo OAuth de Google. Vuelve a la misma URL de origen, conservando la
 * ruta de la app (el hash): si entrás desde `#admin`, volvés a `#admin`.
 */
async function entrar(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.hash },
  })
}

/** Cierra la sesión. Los datos locales quedan intactos. */
async function cerrarSesion(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

/**
 * La sesión del usuario contra Supabase.
 *
 * `useSession` queda como función suelta y no como método: es un HOOK de React, y React
 * exige que los hooks se llamen desde el cuerpo de un componente y se llamen `use*`.
 * Ese límite lo pone el framework, no el diseño.
 */
export class Auth {
  /** Abre el login de Google (PKCE), conservando el hash actual al volver. */
  static entrarConGoogle(): Promise<void> {
    return entrar()
  }

  /**
   * Cierra la sesión. Deja el avance en localStorage a propósito: sirve de caché
   * offline y volver a entrar lo reconcilia por merge.
   */
  static salir(): Promise<void> {
    return cerrarSesion()
  }
}
