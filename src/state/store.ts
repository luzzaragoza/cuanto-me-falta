import { useSyncExternalStore } from 'react'
import { Store } from '../domain/Store'
import type { DB, Espejo } from '../types'
import type { PlanDef } from '../data/model'
import { PLANES, getPlanDef } from '../data/planes'
import { planActivoId, storageKey } from './planActivo'
import { espejoDe } from '../lib/espejo'

function leerDB(key: string): DB | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as DB) : null
  } catch {
    return null
  }
}

/** Avance heredado de las otras carreras (materias compartidas). Ver lib/espejo.ts. */
function espejoDelPlanActivo(): Espejo {
  const id = planActivoId()
  const otros = PLANES.filter((p) => p.id !== id)
    .map((p) => ({ plan: p, db: leerDB(storageKey(p.id)) }))
    .filter((o): o is { plan: PlanDef; db: DB } => o.db !== null)
  return espejoDe(getPlanDef(id), otros)
}

/** Instancia única del estado del usuario, con la clave del plan activo (progreso por carrera). */
export const store = new Store(storageKey(planActivoId()), espejoDelPlanActivo())

/** Hook: re-renderiza el componente cuando cambia la DB. Devuelve la DB actual. */
export function useDB() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
