import type { DB, Estado } from '../types'
import { plan } from './Plan'

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
