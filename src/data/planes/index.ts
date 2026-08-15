import { PlanDef, Universidad } from '../model'
import { Registro } from '../registro'
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
export const UNIVERSIDADES_BUNDLE: Universidad[] = [new Universidad('uade', 'UADE')]

/**
 * Planes del bundle (piso y fallback). El orden es el del selector de carrera.
 *
 * Los módulos de al lado son literales JSON: acá cruzan la frontera y se vuelven
 * objetos. Se usa `exigir()` y no `desde()` a propósito — un plan del repo mal formado
 * es un bug del repo, y tiene que reventar al importar (o sea, en CI), no degradarse
 * en silencio como sí corresponde con lo que llega del backend.
 */
export const PLANES_BUNDLE: PlanDef[] = [
  ingInformatica,
  gestionTecnologia,
  desarrolloSoftware,
  iaCienciaDatos,
].map((j) => PlanDef.exigir(j))

const registro = Registro.inicial(new Registro(UNIVERSIDADES_BUNDLE, PLANES_BUNDLE))

export const UNIVERSIDADES: readonly Universidad[] = registro.universidades
export const PLANES: readonly PlanDef[] = registro.planes

/** Plan que se muestra por defecto (y clave de storage legacy — no cambiar el id). */
export const PLAN_POR_DEFECTO = ingInformatica.id

/** Busca un plan por id; si no existe, cae al por defecto (y si tampoco, al primero). */
export function getPlanDef(id: string): PlanDef {
  return (
    PLANES.find((p) => p.id === id) ??
    PLANES.find((p) => p.id === PLAN_POR_DEFECTO) ??
    PLANES[0] ??
    PLANES_BUNDLE[0]
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
