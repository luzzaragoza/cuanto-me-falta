import { DB, type Perfil } from '../types'
import { PLAN_POR_DEFECTO, existePlan } from '../data/planes'

// Cuál plan/carrera está viendo el usuario. Se guarda aparte del progreso.
const PLAN_ACTIVO_KEY = 'cmf-plan-activo'

function tieneStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

/** Id del plan activo (o el por defecto). Seguro fuera del navegador (tests). */
function idDelPlanActivo(): string {
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
function claveDeStorage(planId: string): string {
  return planId === PLAN_POR_DEFECTO ? 'plan-uade-v3' : `plan-${planId}-v3`
}

/**
 * Cambia el plan activo y recarga la app (así el dominio se reconstruye con el plan
 * nuevo, sin refactorizar el singleton). Opcionalmente siembra el perfil en el plan
 * destino: `pisar` fuerza el nombre nuevo (bienvenida); si no, solo lo copia cuando el
 * plan destino todavía no tiene perfil (para no re-preguntar al cambiar de carrera).
 */
function cambiarDePlan(planId: string, perfil?: Perfil, pisar = false): void {
  if (!tieneStorage()) return
  try {
    const key = claveDeStorage(planId)
    const raw = localStorage.getItem(key)
    const guardada = raw ? DB.desde(JSON.parse(raw)) : DB.vacia()
    const db = perfil && (pisar || guardada.profile === undefined)
      ? guardada.conPerfil(perfil)
      : guardada
    localStorage.setItem(key, JSON.stringify(db.aJSON()))
    localStorage.setItem(PLAN_ACTIVO_KEY, planId)
  } catch {
    /* si falla el storage, igual recargamos: el plan activo se resuelve al default */
  }
  location.reload()
}

/**
 * Qué carrera está mirando el usuario, y dónde se guarda su avance.
 *
 * Cada plan tiene su propia clave de localStorage, así el progreso de una carrera no se
 * mezcla con el de otra. El `id` del plan por defecto conserva la clave histórica
 * (`plan-uade-v3`) para no dejar huérfano el avance de quien ya la tenía.
 */
export class PlanActivo {
  /** El id del plan activo (o el por defecto si lo guardado ya no existe). */
  static id(): string {
    return idDelPlanActivo()
  }

  /** La clave de localStorage donde vive el avance de ese plan. */
  static claveDe(planId: string): string {
    return claveDeStorage(planId)
  }

  /**
   * Cambia el plan activo y recarga la app (así el dominio se reconstruye con el plan
   * nuevo). Opcionalmente siembra el perfil en el plan destino.
   */
  static cambiarA(planId: string, perfil?: Perfil, pisar = false): void {
    cambiarDePlan(planId, perfil, pisar)
  }
}
