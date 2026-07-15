// Materias compartidas entre carreras.
//
// En una misma universidad, el mismo código de materia ES la misma materia:
// si la aprobaste cursando una carrera, tiene que figurar aprobada en la otra
// (Ing. Informática y Lic. en Gestión de TI comparten 22, por ejemplo).
//
// El enfoque es un "espejo" DERIVADO, no una copia: cada plan sigue guardando
// solo sus propias marcas en su clave de localStorage (y eso es lo que viaja
// por el sync), y al construir el Store del plan activo se calcula qué estados
// heredaría de las otras carreras. El Store lo pone debajo de sus marcas al
// armar el snapshot de la UI. Ventajas: nada se duplica (no hay dos copias que
// puedan divergir ni pisarse en un merge del sync), funciona retroactivamente
// con el avance ya cargado, y una marca explícita del plan activo siempre gana.
//
// Quedan afuera las optativas (el slot es una elección de cada plan, aunque el
// código coincida) y las materias custom (sus códigos los inventa el usuario).

import type { DB, Espejo, Estado } from '../types'
import type { PlanDef } from '../data/model'

/** Cuán avanzado es un estado — entre carreras gana el más avanzado. */
const RANGO: Record<Estado, number> = { pendiente: 0, cursando: 1, final: 2, aprobada: 3 }

/**
 * Calcula el espejo del plan activo a partir de las otras carreras del usuario.
 * `otros` = cada otro plan con su DB guardada (los que no tienen datos, ni van).
 */
export function espejoDe(plan: PlanDef, otros: Array<{ plan: PlanDef; db: DB }>): Espejo {
  const espejo: Espejo = { states: {}, notas: {} }
  const propias = new Set(plan.materias.filter((m) => !m.opt).map((m) => m.cod))

  for (const otro of otros) {
    if (otro.plan.id === plan.id || otro.plan.universidad !== plan.universidad) continue
    for (const m of otro.plan.materias) {
      if (m.opt || !propias.has(m.cod)) continue
      const estado = otro.db.states[m.cod]
      if (!estado || estado === 'pendiente') continue
      const actual = espejo.states[m.cod]
      if (actual && RANGO[actual] >= RANGO[estado]) continue
      espejo.states[m.cod] = estado
      // la nota acompaña al estado ganador (si su plan no tiene, no se inventa)
      const nota = otro.db.notas[m.cod]
      if (nota !== undefined) espejo.notas[m.cod] = nota
      else delete espejo.notas[m.cod]
    }
  }
  return espejo
}
