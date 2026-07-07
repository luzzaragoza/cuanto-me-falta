import type { DB, Perfil } from '../types'
import { PLAN_POR_DEFECTO, existePlan } from '../data/planes'

// Cuál plan/carrera está viendo el usuario. Se guarda aparte del progreso.
const PLAN_ACTIVO_KEY = 'cmf-plan-activo'

function tieneStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

/** Id del plan activo (o el por defecto). Seguro fuera del navegador (tests). */
export function planActivoId(): string {
  if (!tieneStorage()) return PLAN_POR_DEFECTO
  try {
    const id = localStorage.getItem(PLAN_ACTIVO_KEY)
    return id && existePlan(id) ? id : PLAN_POR_DEFECTO
  } catch {
    return PLAN_POR_DEFECTO
  }
}

/**
 * Clave de localStorage del PROGRESO de un plan. El plan por defecto mantiene la
 * clave histórica `plan-uade-v3` (para no perder los datos ya guardados); los demás
 * usan una clave propia. Así cada carrera guarda su avance por separado.
 */
export function storageKey(planId: string): string {
  return planId === PLAN_POR_DEFECTO ? 'plan-uade-v3' : `plan-${planId}-v3`
}

const emptyDB = (): DB => ({ states: {}, notas: {}, optNames: {}, custom: [] })

/**
 * Cambia el plan activo y recarga la app (así el dominio se reconstruye con el plan
 * nuevo, sin refactorizar el singleton). Opcionalmente siembra el perfil en el plan
 * destino: `pisar` fuerza el nombre nuevo (bienvenida); si no, solo lo copia cuando el
 * plan destino todavía no tiene perfil (para no re-preguntar al cambiar de carrera).
 */
export function cambiarAPlan(planId: string, perfil?: Perfil, pisar = false): void {
  if (!tieneStorage()) return
  try {
    const key = storageKey(planId)
    const raw = localStorage.getItem(key)
    const db: DB = raw ? JSON.parse(raw) : emptyDB()
    if (perfil && (pisar || db.profile === undefined)) db.profile = perfil
    localStorage.setItem(key, JSON.stringify(db))
    localStorage.setItem(PLAN_ACTIVO_KEY, planId)
  } catch {
    /* si falla el storage, igual recargamos: el plan activo se resuelve al default */
  }
  location.reload()
}
