import { useSyncExternalStore } from 'react'
import { Store } from '../domain/Store'
import { DB, Espejo } from '../types'
import type { PlanDef } from '../data/model'
import { PLANES, getPlanDef } from '../data/planes'
import { PlanActivo } from './planActivo'

/**
 * Lee la DB de OTRA carrera (para calcular el espejo).
 *
 * Va por `DB.desde()` y no por un `as DB`: el cast le miente al compilador —dice
 * "confiá, esto es una DB"— pero `JSON.parse` devuelve un objeto plano sin métodos, así
 * que el error no aparece al compilar sino en el navegador, la primera vez que alguien
 * llama un método. Pasó exactamente eso acá.
 */
function leerDB(key: string): DB | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? DB.desde(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/** Avance heredado de las otras carreras (materias compartidas). Ver lib/espejo.ts. */
function espejoDelPlanActivo(): Espejo {
  const id = PlanActivo.id()
  const otros = PLANES.filter((p) => p.id !== id)
    .map((p) => ({ plan: p, db: leerDB(PlanActivo.claveDe(p.id)) }))
    .filter((o): o is { plan: PlanDef; db: DB } => o.db !== null)
  return Espejo.deOtrasCarreras(getPlanDef(id), otros)
}

/** Instancia única del estado del usuario, con la clave del plan activo (progreso por carrera). */
export const store = new Store(PlanActivo.claveDe(PlanActivo.id()), espejoDelPlanActivo())

/** Hook: re-renderiza el componente cuando cambia la DB. Devuelve la DB actual. */
export function useDB() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
