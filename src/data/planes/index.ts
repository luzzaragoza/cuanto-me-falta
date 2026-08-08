import type { PlanDef, Universidad } from '../model'
import { registroInicial } from '../registro'
import { ingInformatica } from './ing-informatica'
import { gestionTecnologia } from './gestion-tecnologia'
import { desarrolloSoftware } from './desarrollo-software'
import { iaCienciaDatos } from './ia-ciencia-datos'

// Registro de datos académicos.
//
// Los planes de acá abajo son el SNAPSHOT que viaja en el bundle: con esto la app abre
// sin red, sin cuenta y sin backend configurado. Si en una visita anterior se bajó algo
// distinto del backend (planes nuevos, correcciones del admin), `registroInicial` lo
// levanta del caché y eso es lo que se usa. Ver `src/data/registro.ts` (ADR-11).

/** Universidades del bundle (piso y fallback). */
export const UNIVERSIDADES_BUNDLE: Universidad[] = [{ id: 'uade', nombre: 'UADE' }]

/** Planes del bundle (piso y fallback). El orden es el del selector de carrera. */
export const PLANES_BUNDLE: PlanDef[] = [
  ingInformatica,
  gestionTecnologia,
  desarrolloSoftware,
  iaCienciaDatos,
]

const registro = registroInicial({
  universidades: UNIVERSIDADES_BUNDLE,
  planes: PLANES_BUNDLE,
})

export const UNIVERSIDADES: Universidad[] = registro.universidades
export const PLANES: PlanDef[] = registro.planes

/** Plan que se muestra por defecto (y clave de storage legacy — no cambiar el id). */
export const PLAN_POR_DEFECTO = ingInformatica.id

/** Busca un plan por id; si no existe, cae al por defecto (y si tampoco, al primero). */
export function getPlanDef(id: string): PlanDef {
  return (
    PLANES.find((p) => p.id === id) ??
    PLANES.find((p) => p.id === PLAN_POR_DEFECTO) ??
    PLANES[0] ??
    ingInformatica
  )
}

/** ¿Existe un plan con ese id? */
export function existePlan(id: string): boolean {
  return PLANES.some((p) => p.id === id)
}

/** Nombre de una universidad por id. */
export function nombreUniversidad(id: string): string {
  return UNIVERSIDADES.find((u) => u.id === id)?.nombre ?? id
}
