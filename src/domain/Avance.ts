// Cuánto le falta al alumno: la pregunta que le da nombre a la app.
//
// Antes esto eran once funciones sueltas en `selectors.ts`, y TODAS empezaban igual:
// recibían la `DB` como primer parámetro y leían el plan del singleton global. Ese es
// el olor clásico de un método disfrazado de función — el primer argumento siempre es
// el mismo objeto, y la otra mitad del estado entra por una variable global.
//
// Acá el par (plan, avance del alumno) se construye una vez y responde preguntas.
// Como efecto lateral lindo, el `plan` deja de ser una dependencia escondida: se pasa,
// así que probar con un plan de juguete no necesita tocar ningún singleton.

import type { DB, Estado } from '../types'
import type { MateriaUbicada, Plan } from './Plan'
import { plan as planActivo } from './Plan'
import type { TituloPlan } from '../data/model'

/** Conteos y porcentaje sobre todas las materias del plan. */
export interface Conteos {
  total: number
  aprobadas: number
  final: number
  cursando: number
  pendientes: number
  pct: number
}

export interface Hito {
  titulo: string
  falta: number
  ok: boolean
}

export interface AvanceAnio {
  year: number
  aprobadas: number
  total: number
}

export class Avance {
  private readonly plan: Plan
  private readonly db: DB

  constructor(plan: Plan, db: DB) {
    this.plan = plan
    this.db = db
  }

  /** Estado de una materia (con el espejo de otras carreras ya aplicado por la DB). */
  estado(cod: string): Estado {
    return this.db.estado(cod)
  }

  /** Conteos y porcentaje de avance sobre todas las materias del plan. */
  get conteos(): Conteos {
    const mats = this.plan.materias()
    let aprobadas = 0
    let final = 0
    let cursando = 0
    for (const m of mats) {
      const s = this.estado(m.cod)
      if (s === 'aprobada') aprobadas++
      else if (s === 'final') final++
      else if (s === 'cursando') cursando++
    }
    const total = mats.length
    return {
      total,
      aprobadas,
      final,
      cursando,
      pendientes: total - aprobadas - final - cursando,
      pct: total ? Math.round((aprobadas / total) * 100) : 0,
    }
  }

  /** Promedio SIN aplazos: solo aprobadas con nota cargada. `null` si no hay ninguna. */
  get promedio(): { valor: number | null; conNota: number } {
    const notas = this.plan
      .materias()
      .filter((m) => this.estado(m.cod) === 'aprobada' && this.db.nota(m.cod) != null)
      .map((m) => this.db.nota(m.cod)!)
    if (!notas.length) return { valor: null, conNota: 0 }
    const media = notas.reduce((a, b) => a + b, 0) / notas.length
    return { valor: Math.round(media * 100) / 100, conNota: notas.length }
  }

  /** Nombre a mostrar: usa el nombre custom de la optativa si el alumno le puso uno. */
  nombreDe(cod: string): string {
    const propio = this.db.optName(cod)
    if (this.plan.isOpt(cod) && propio) return propio
    return this.plan.nombre(cod)
  }

  /** Previas directas que siguen en 'pendiente'. */
  previasFaltantes(cod: string): string[] {
    return this.plan.antes(cod).filter((p) => this.estado(p) === 'pendiente')
  }

  /**
   * Previas que NO cumplen la regla para pasar la materia al estado dado.
   * - cursar / pend. de final: la previa tiene que estar al menos **en curso**.
   * - aprobada (rendir el final): la previa tiene que estar **aprobada**.
   * Devuelve [] para 'pendiente'. Base para el aviso de correlativas.
   */
  previasParaEstado(cod: string, estado: Estado): string[] {
    const previas = this.plan.antes(cod)
    if (estado === 'cursando' || estado === 'final') {
      return previas.filter((p) => this.estado(p) === 'pendiente')
    }
    if (estado === 'aprobada') {
      return previas.filter((p) => this.estado(p) !== 'aprobada')
    }
    return []
  }

  /**
   * ¿Está disponible para cursar? Pendiente + no especial + no custom + todas las
   * previas directas al menos en curso (sin previas = cursable).
   */
  disponible(cod: string): boolean {
    return (
      this.estado(cod) === 'pendiente' &&
      !this.plan.isSpecial(cod) &&
      !cod.startsWith('CUST') &&
      this.previasFaltantes(cod).length === 0
    )
  }

  /** Hitos de título. `falta` = materias no aprobadas hasta su año/cuatrimestre. */
  get hitos(): Hito[] {
    return this.plan.titulos().map((t: TituloPlan) => {
      const falta = this.plan.materiasHasta(t).filter((m) => this.estado(m.cod) !== 'aprobada').length
      return { titulo: t.nombre, falta, ok: falta === 0 }
    })
  }

  /** Avance (aprobadas/total) por año. */
  get porAnio(): AvanceAnio[] {
    return this.plan.anios.map((a) => {
      const mats = a.mats
      const aprobadas = mats.filter((m) => this.estado(m.cod) === 'aprobada').length
      return { year: a.year, aprobadas, total: mats.length }
    })
  }

  /**
   * Interruptor de año (pedido por un usuario en el feedback, 4-ago): un solo botón que
   * aprueba el año entero, y si ya está entero aprobado lo deja en blanco. Pisa lo que
   * hubiera (decisión de producto: el que lo toca sabe que cursó ese año). Las notas NO
   * se tocan: viven aparte de los estados.
   */
  decidirAnio(cods: string[]): Estado {
    const completo = cods.length > 0 && cods.every((c) => this.estado(c) === 'aprobada')
    return completo ? 'pendiente' : 'aprobada'
  }

  /** Materias en un estado dado (para las listas del resumen). */
  materiasEn(estado: Estado): MateriaUbicada[] {
    return this.plan.materias().filter((m) => this.estado(m.cod) === estado)
  }
}

/**
 * El avance sobre el plan ACTIVO. Es el atajo que usan los componentes, que casi siempre
 * quieren esto; el constructor queda para los tests y para el editor, que trabajan sobre
 * un plan que no es el del alumno.
 */
export function avanceDe(db: DB, plan: Plan = planActivo): Avance {
  return new Avance(plan, db)
}
