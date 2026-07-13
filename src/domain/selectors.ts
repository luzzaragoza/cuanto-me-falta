import type { DB, Estado } from '../types'
import { plan, type MateriaUbicada } from './Plan'

export interface Avance {
  total: number
  aprobadas: number
  final: number
  cursando: number
  pendientes: number
  pct: number
}

const estadoDe = (db: DB, cod: string): Estado => db.states[cod] ?? 'pendiente'

/** Conteos y porcentaje de avance sobre todas las materias del plan. */
export function avance(db: DB): Avance {
  const mats = plan.materias()
  let aprobadas = 0,
    final = 0,
    cursando = 0
  for (const m of mats) {
    const s = estadoDe(db, m.cod)
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

/** Promedio SIN aplazos: solo aprobadas con nota cargada. null si no hay ninguna. */
export function promedio(db: DB): { valor: number | null; conNota: number } {
  const notas = plan
    .materias()
    .filter((m) => estadoDe(db, m.cod) === 'aprobada' && db.notas[m.cod] != null)
    .map((m) => db.notas[m.cod])
  if (!notas.length) return { valor: null, conNota: 0 }
  const mean = notas.reduce((a, b) => a + b, 0) / notas.length
  return { valor: Math.round(mean * 100) / 100, conNota: notas.length }
}

/** Nombre a mostrar: usa el nombre custom de la optativa si existe. */
export function nombreDe(db: DB, cod: string): string {
  if (plan.isOpt(cod) && db.optNames[cod]) return db.optNames[cod]
  return plan.nombre(cod)
}

/** Previas directas que siguen en 'pendiente'. */
export function previasFaltantes(db: DB, cod: string): string[] {
  return plan.antes(cod).filter((p) => estadoDe(db, p) === 'pendiente')
}

/**
 * Previas que NO cumplen la regla para pasar la materia al estado dado.
 * - cursar / pend. de final: la previa tiene que estar al menos **en curso** (no 'pendiente').
 * - aprobada (rendir el final): la previa tiene que estar **aprobada**.
 * Devuelve [] para 'pendiente'. Base para el aviso de correlativas.
 */
export function previasParaEstado(db: DB, cod: string, estado: Estado): string[] {
  const previas = plan.antes(cod)
  if (estado === 'cursando' || estado === 'final') {
    return previas.filter((p) => estadoDe(db, p) === 'pendiente')
  }
  if (estado === 'aprobada') {
    return previas.filter((p) => estadoDe(db, p) !== 'aprobada')
  }
  return []
}

/**
 * ¿Está disponible para cursar? Pendiente + no especial + no custom +
 * todas las previas directas al menos en curso (sin previas = cursable).
 */
export function disponible(db: DB, cod: string): boolean {
  return (
    estadoDe(db, cod) === 'pendiente' &&
    !plan.isSpecial(cod) &&
    !cod.startsWith('CUST') &&
    previasFaltantes(db, cod).length === 0
  )
}

/** Iniciales (hasta 2) para el avatar sin foto. */
export function iniciales(name: string | undefined): string {
  if (!name) return ''
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export interface Hito {
  titulo: string
  falta: number
  ok: boolean
}

/** Hitos de título del plan activo. `falta` = materias no aprobadas hasta su año/cuatrimestre. */
export function hitos(db: DB): Hito[] {
  return plan.titulos().map((t) => {
    const falta = plan.materiasHasta(t).filter((m) => estadoDe(db, m.cod) !== 'aprobada').length
    return { titulo: t.nombre, falta, ok: falta === 0 }
  })
}

export interface AvanceAnio {
  year: number
  aprobadas: number
  total: number
}

/** Avance (aprobadas/total) por año. */
export function avancePorAnio(db: DB): AvanceAnio[] {
  return plan.anios.map((a) => {
    const mats = a.cuatris.flatMap((q) => q.mats)
    const aprobadas = mats.filter((m) => estadoDe(db, m.cod) === 'aprobada').length
    return { year: a.year, aprobadas, total: mats.length }
  })
}

/** Materias en un estado dado (para las listas del resumen). */
export function materiasEnEstado(db: DB, estado: Estado): MateriaUbicada[] {
  return plan.materias().filter((m) => estadoDe(db, m.cod) === estado)
}
