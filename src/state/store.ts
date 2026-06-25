import { useSyncExternalStore } from 'react'
import { Store } from '../domain/Store'

/** Instancia única del estado del usuario. */
export const store = new Store()

/** Hook: re-renderiza el componente cuando cambia la DB. Devuelve la DB actual. */
export function useDB() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
