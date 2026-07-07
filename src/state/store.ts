import { useSyncExternalStore } from 'react'
import { Store } from '../domain/Store'
import { planActivoId, storageKey } from './planActivo'

/** Instancia única del estado del usuario, con la clave del plan activo (progreso por carrera). */
export const store = new Store(storageKey(planActivoId()))

/** Hook: re-renderiza el componente cuando cambia la DB. Devuelve la DB actual. */
export function useDB() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
