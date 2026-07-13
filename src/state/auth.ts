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

if (supabase) {
  // sesión inicial (si el usuario ya estaba logueado) + cambios (login/logout,
  // y el parseo del token cuando Google redirige de vuelta a la app)
  supabase.auth.getSession().then(({ data }) => {
    session = data.session
    emit()
  })
  supabase.auth.onAuthStateChange((_evento, nueva) => {
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

/** Dispara el flujo OAuth de Google. Vuelve a la misma URL de origen. */
export async function entrarConGoogle(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

/** Cierra la sesión. Los datos locales quedan intactos. */
export async function salir(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}
