import type { PlanDef, Universidad } from '../model'
import { ingInformatica } from './ing-informatica'
import { gestionTecnologia } from './gestion-tecnologia'

// Registro de datos académicos (hoy en TS; mañana lo carga el rol admin en el backend).

export const UNIVERSIDADES: Universidad[] = [{ id: 'uade', nombre: 'UADE' }]

export const PLANES: PlanDef[] = [ingInformatica, gestionTecnologia]

/** Plan que se muestra por defecto (y clave de storage legacy — no cambiar el id). */
export const PLAN_POR_DEFECTO = ingInformatica.id

/** Busca un plan por id; devuelve el plan por defecto si no existe. */
export function getPlanDef(id: string): PlanDef {
  return PLANES.find((p) => p.id === id) ?? ingInformatica
}

/** ¿Existe un plan con ese id? */
export function existePlan(id: string): boolean {
  return PLANES.some((p) => p.id === id)
}

/** Nombre de una universidad por id. */
export function nombreUniversidad(id: string): string {
  return UNIVERSIDADES.find((u) => u.id === id)?.nombre ?? id
}
