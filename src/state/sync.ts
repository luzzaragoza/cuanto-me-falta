// Orquestador del sync: escucha la sesión (auth) y el Store, y mantiene la fila
// `progreso` de Supabase al día. Estado observable para la UI (guardando/error/
// conflicto) con el mismo patrón useSyncExternalStore del resto de la app.
//
// Reglas:
// - Al entrar: se trae lo remoto y se decide (lib/sync.decidirMerge). Si ambos
//   lados tienen progreso distinto → 'conflicto' y decide el usuario (modal).
// - Cada cambio local (Store.commit → notify) programa un push con debounce.
// - Sin backend o sin sesión: todo es no-op y la app queda 100% local.

import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { store } from './store'
import {
  decidirMerge,
  escribirLocal,
  snapshotLocal,
  totalMarcadas,
  type RemoteData,
} from '../lib/sync'

export type SyncEstado = 'off' | 'listo' | 'guardando' | 'error' | 'conflicto'

export interface Conflicto {
  remoto: RemoteData
  marcadasLocal: number
  marcadasCuenta: number
}

let estado: SyncEstado = 'off'
let conflicto: Conflicto | null = null
let userId: string | null = null
let mergeHechoPara: string | null = null // evita re-merge en TOKEN_REFRESHED etc.
let timer: ReturnType<typeof setTimeout> | null = null

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const setEstado = (e: SyncEstado) => {
  estado = e
  emit()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Hook: estado del sync para la UI (indicador + modal de conflicto). */
export function useSyncEstado(): SyncEstado {
  return useSyncExternalStore(subscribe, () => estado, () => 'off' as const)
}

export function getConflicto(): Conflicto | null {
  return conflicto
}

// ---- push (subir lo local) ----

const DEBOUNCE_MS = 1500

async function push(): Promise<void> {
  if (!supabase || !userId) return
  setEstado('guardando')
  const { error } = await supabase.from('progreso').upsert({
    user_id: userId,
    data: snapshotLocal(),
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.warn('[sync] push falló:', error.message)
    setEstado('error')
  } else {
    setEstado('listo')
  }
}

function programarPush(): void {
  // sin sesión, o con un conflicto sin resolver, no se sube nada
  if (!userId || estado === 'conflicto') return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void push()
  }, DEBOUNCE_MS)
}

// ---- merge inicial al entrar ----

async function alEntrar(uid: string): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase
    .from('progreso')
    .select('data')
    .eq('user_id', uid)
    .maybeSingle()

  if (error) {
    console.warn('[sync] no pude leer lo remoto:', error.message)
    setEstado('error')
    return
  }

  const remoto = (data?.data as RemoteData | undefined) ?? null
  const local = snapshotLocal()

  switch (decidirMerge(remoto, local)) {
    case 'push':
      await push()
      break
    case 'pull':
      escribirLocal(remoto!)
      location.reload() // el singleton del Store se reconstruye con lo bajado
      break
    case 'nada':
      setEstado('listo')
      break
    case 'conflicto':
      conflicto = {
        remoto: remoto!,
        marcadasLocal: totalMarcadas(local),
        marcadasCuenta: totalMarcadas(remoto),
      }
      setEstado('conflicto')
      break
  }
}

/** El usuario eligió en el modal de conflicto. */
export function resolverConflicto(eleccion: 'cuenta' | 'dispositivo'): void {
  if (!conflicto) return
  const remoto = conflicto.remoto
  conflicto = null
  if (eleccion === 'cuenta') {
    escribirLocal(remoto)
    location.reload()
  } else {
    // decisión explícita del usuario: lo local pisa la cuenta
    void push()
  }
}

// ---- init (llamar una vez, en main.tsx) ----

export function initSync(): void {
  if (!supabase) return

  supabase.auth.onAuthStateChange((_evento, session) => {
    const uid = session?.user.id ?? null
    userId = uid
    if (!uid) {
      mergeHechoPara = null
      conflicto = null
      setEstado('off')
      return
    }
    if (mergeHechoPara !== uid) {
      mergeHechoPara = uid
      void alEntrar(uid)
    }
  })

  // cada cambio del usuario (estado/nota/optativa/perfil) programa un push
  store.subscribe(programarPush)
}
