import { describe, it, expect } from 'vitest'
import {
  avance,
  promedio,
  previasParaEstado,
  previasFaltantes,
  disponible,
  hitos,
  nombreDe,
} from './selectors'
import { plan } from './Plan'
import type { DB, Estado } from '../types'

// Helper: arma una DB parcial. Todo lo no seteado queda 'pendiente' / sin nota.
const db = (
  states: Record<string, Estado> = {},
  notas: Record<string, number> = {},
  optNames: Record<string, string> = {},
): DB => ({ states, notas, optNames, custom: [] })

// Códigos reales del Plan 1621 usados en los tests:
const FUNDAMENTOS = '3.4.069' // sin previas
const PROG1 = '3.4.071' // necesita Fundamentos

describe('avance', () => {
  it('con la DB vacía, todo pendiente y 0%', () => {
    const a = avance(db())
    expect(a.aprobadas).toBe(0)
    expect(a.pct).toBe(0)
    expect(a.total).toBe(plan.materias().length)
    expect(a.pendientes).toBe(a.total)
  })

  it('cuenta cada estado por separado', () => {
    const a = avance(db({ [FUNDAMENTOS]: 'aprobada', [PROG1]: 'cursando' }))
    expect(a.aprobadas).toBe(1)
    expect(a.cursando).toBe(1)
    expect(a.pendientes).toBe(a.total - 2)
  })

  it('con todo aprobado llega a 100% y 0 pendientes', () => {
    const states: Record<string, Estado> = {}
    for (const m of plan.materias()) states[m.cod] = 'aprobada'
    const a = avance(db(states))
    expect(a.pct).toBe(100)
    expect(a.pendientes).toBe(0)
  })
})

describe('promedio (sin aplazos, solo aprobadas con nota)', () => {
  it('sin notas cargadas devuelve null', () => {
    expect(promedio(db())).toEqual({ valor: null, conNota: 0 })
  })

  it('promedia solo las materias aprobadas con nota', () => {
    const r = promedio(db({ [FUNDAMENTOS]: 'aprobada', [PROG1]: 'aprobada' }, { [FUNDAMENTOS]: 7, [PROG1]: 10 }))
    expect(r.valor).toBe(8.5)
    expect(r.conNota).toBe(2)
  })

  it('ignora la nota si la materia no está aprobada', () => {
    const r = promedio(db({ [FUNDAMENTOS]: 'cursando' }, { [FUNDAMENTOS]: 9 }))
    expect(r).toEqual({ valor: null, conNota: 0 })
  })

  it('redondea a dos decimales', () => {
    const r = promedio(
      db(
        { [FUNDAMENTOS]: 'aprobada', [PROG1]: 'aprobada' },
        { [FUNDAMENTOS]: 8, [PROG1]: 9 },
      ),
    )
    expect(r.valor).toBe(8.5)
  })
})

// El corazón de la app: la regla de correlativas de UADE.
// Cursar (o quedar pend. de final) exige la previa AL MENOS en curso.
// Rendir el final (aprobar) exige la previa APROBADA.
describe('previasParaEstado · regla cursar vs rendir', () => {
  it('para cursar, la previa pendiente bloquea', () => {
    expect(previasParaEstado(db(), PROG1, 'cursando')).toEqual([FUNDAMENTOS])
  })

  it('para cursar, alcanza con la previa en curso', () => {
    expect(previasParaEstado(db({ [FUNDAMENTOS]: 'cursando' }), PROG1, 'cursando')).toEqual([])
  })

  it('quedar pend. de final sigue la misma regla que cursar', () => {
    expect(previasParaEstado(db({ [FUNDAMENTOS]: 'cursando' }), PROG1, 'final')).toEqual([])
  })

  it('para aprobar (rendir), la previa en curso NO alcanza', () => {
    expect(previasParaEstado(db({ [FUNDAMENTOS]: 'cursando' }), PROG1, 'aprobada')).toEqual([FUNDAMENTOS])
  })

  it('para aprobar, la previa tiene que estar aprobada', () => {
    expect(previasParaEstado(db({ [FUNDAMENTOS]: 'aprobada' }), PROG1, 'aprobada')).toEqual([])
  })

  it('marcar pendiente nunca reclama previas', () => {
    expect(previasParaEstado(db(), PROG1, 'pendiente')).toEqual([])
  })
})

describe('previasFaltantes', () => {
  it('lista las previas directas que siguen pendientes', () => {
    expect(previasFaltantes(db(), PROG1)).toEqual([FUNDAMENTOS])
  })

  it('no reclama nada si la previa ya arrancó', () => {
    expect(previasFaltantes(db({ [FUNDAMENTOS]: 'cursando' }), PROG1)).toEqual([])
  })
})

describe('disponible', () => {
  it('una materia sin previas es cursable desde el arranque', () => {
    expect(disponible(db(), FUNDAMENTOS)).toBe(true)
  })

  it('con la previa al menos en curso, queda disponible', () => {
    expect(disponible(db({ [FUNDAMENTOS]: 'cursando' }), PROG1)).toBe(true)
  })

  it('con la previa pendiente, NO está disponible', () => {
    expect(disponible(db(), PROG1)).toBe(false)
  })

  it('lo que ya no está pendiente no se marca como disponible', () => {
    expect(disponible(db({ [FUNDAMENTOS]: 'aprobada' }), FUNDAMENTOS)).toBe(false)
  })

  it('las materias especiales (optativas) nunca se marcan disponibles', () => {
    expect(disponible(db(), 'OPT1')).toBe(false)
  })
})

describe('hitos', () => {
  it('devuelve Analista e Ingeniero, sin cumplir con la DB vacía', () => {
    const h = hitos(db())
    expect(h.map((x) => x.titulo)).toEqual(['Analista en Informática', 'Ingeniero en Informática'])
    expect(h.every((x) => !x.ok && x.falta > 0)).toBe(true)
  })

  it('con todo aprobado, ambos hitos quedan cumplidos', () => {
    const states: Record<string, Estado> = {}
    for (const m of plan.materias()) states[m.cod] = 'aprobada'
    const h = hitos(db(states))
    expect(h.every((x) => x.ok && x.falta === 0)).toBe(true)
  })
})

describe('nombreDe', () => {
  it('usa el nombre custom de la optativa si está cargado', () => {
    expect(nombreDe(db({}, {}, { OPT1: 'Machine Learning' }), 'OPT1')).toBe('Machine Learning')
  })

  it('sin nombre custom, cae al nombre base de la optativa', () => {
    expect(nombreDe(db(), 'OPT1')).toBe('Optativa I')
  })

  it('una materia normal siempre usa su nombre del plan', () => {
    expect(nombreDe(db({}, {}, { [FUNDAMENTOS]: 'Otro nombre' }), FUNDAMENTOS)).toBe(
      'Fundamentos de Informática',
    )
  })
})
