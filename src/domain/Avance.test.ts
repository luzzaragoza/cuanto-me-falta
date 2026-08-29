import { describe, it, expect } from 'vitest'
import { avanceDe } from './Avance'
import { plan } from './Plan'
import { DB, type Estado } from '../types'

// Helper: el avance del alumno sobre el plan activo, con una DB parcial.
// Todo lo no seteado queda 'pendiente' / sin nota.
const av = (
  states: Record<string, Estado> = {},
  notas: Record<string, number> = {},
  optNames: Record<string, string> = {},
) => avanceDe(new DB(states, notas, optNames))

// Códigos reales del Plan 1621 usados en los tests:
const FUNDAMENTOS = '3.4.069' // sin previas
const PROG1 = '3.4.071' // necesita Fundamentos

describe('Avance · conteos', () => {
  it('con la DB vacía, todo pendiente y 0%', () => {
    const a = av().conteos
    expect(a.aprobadas).toBe(0)
    expect(a.pct).toBe(0)
    expect(a.total).toBe(plan.materias().length)
    expect(a.pendientes).toBe(a.total)
  })

  it('cuenta cada estado por separado', () => {
    const a = av({ [FUNDAMENTOS]: 'aprobada', [PROG1]: 'cursando' }).conteos
    expect(a.aprobadas).toBe(1)
    expect(a.cursando).toBe(1)
    expect(a.pendientes).toBe(a.total - 2)
  })

  it('con todo aprobado llega a 100% y 0 pendientes', () => {
    const states: Record<string, Estado> = {}
    for (const m of plan.materias()) states[m.cod] = 'aprobada'
    const a = av(states).conteos
    expect(a.pct).toBe(100)
    expect(a.pendientes).toBe(0)
  })
})

describe('Avance · promedio (sin aplazos, solo aprobadas con nota)', () => {
  it('sin notas cargadas devuelve null', () => {
    expect(av().promedio).toEqual({ valor: null, conNota: 0 })
  })

  it('promedia solo las materias aprobadas con nota', () => {
    const r = av({ [FUNDAMENTOS]: 'aprobada', [PROG1]: 'aprobada' }, { [FUNDAMENTOS]: 7, [PROG1]: 10 }).promedio
    expect(r.valor).toBe(8.5)
    expect(r.conNota).toBe(2)
  })

  it('ignora la nota si la materia no está aprobada', () => {
    const r = av({ [FUNDAMENTOS]: 'cursando' }, { [FUNDAMENTOS]: 9 }).promedio
    expect(r).toEqual({ valor: null, conNota: 0 })
  })

  it('redondea a dos decimales', () => {
    const r = av(
        { [FUNDAMENTOS]: 'aprobada', [PROG1]: 'aprobada' },
        { [FUNDAMENTOS]: 8, [PROG1]: 9 },
      ).promedio
    expect(r.valor).toBe(8.5)
  })
})

// El corazón de la app: la regla de correlativas de UADE.
// Cursar (o quedar pend. de final) exige la previa AL MENOS en curso.
// Rendir el final (aprobar) exige la previa APROBADA.
describe('Avance · previasParaEstado · regla cursar vs rendir', () => {
  it('para cursar, la previa pendiente bloquea', () => {
    expect(av().previasParaEstado(PROG1, 'cursando')).toEqual([FUNDAMENTOS])
  })

  it('para cursar, alcanza con la previa en curso', () => {
    expect(av({ [FUNDAMENTOS]: 'cursando' }).previasParaEstado(PROG1, 'cursando')).toEqual([])
  })

  it('quedar pend. de final sigue la misma regla que cursar', () => {
    expect(av({ [FUNDAMENTOS]: 'cursando' }).previasParaEstado(PROG1, 'final')).toEqual([])
  })

  it('para aprobar (rendir), la previa en curso NO alcanza', () => {
    expect(av({ [FUNDAMENTOS]: 'cursando' }).previasParaEstado(PROG1, 'aprobada')).toEqual([FUNDAMENTOS])
  })

  it('para aprobar, la previa tiene que estar aprobada', () => {
    expect(av({ [FUNDAMENTOS]: 'aprobada' }).previasParaEstado(PROG1, 'aprobada')).toEqual([])
  })

  it('marcar pendiente nunca reclama previas', () => {
    expect(av().previasParaEstado(PROG1, 'pendiente')).toEqual([])
  })
})

describe('Avance · previasFaltantes', () => {
  it('lista las previas directas que siguen pendientes', () => {
    expect(av().previasFaltantes(PROG1)).toEqual([FUNDAMENTOS])
  })

  it('no reclama nada si la previa ya arrancó', () => {
    expect(av({ [FUNDAMENTOS]: 'cursando' }).previasFaltantes(PROG1)).toEqual([])
  })
})

describe('Avance · disponible', () => {
  it('una materia sin previas es cursable desde el arranque', () => {
    expect(av().disponible(FUNDAMENTOS)).toBe(true)
  })

  it('con la previa al menos en curso, queda disponible', () => {
    expect(av({ [FUNDAMENTOS]: 'cursando' }).disponible(PROG1)).toBe(true)
  })

  it('con la previa pendiente, NO está disponible', () => {
    expect(av().disponible(PROG1)).toBe(false)
  })

  it('lo que ya no está pendiente no se marca como disponible', () => {
    expect(av({ [FUNDAMENTOS]: 'aprobada' }).disponible(FUNDAMENTOS)).toBe(false)
  })

  it('las materias especiales (optativas) nunca se marcan disponibles', () => {
    expect(av().disponible('OPT1')).toBe(false)
  })
})

describe('Avance · hitos', () => {
  it('devuelve Analista e Ingeniero, sin cumplir con la DB vacía', () => {
    const h = av().hitos
    expect(h.map((x) => x.titulo)).toEqual(['Analista en Informática', 'Ingeniero en Informática'])
    expect(h.every((x) => !x.ok && x.falta > 0)).toBe(true)
  })

  it('con todo aprobado, ambos hitos quedan cumplidos', () => {
    const states: Record<string, Estado> = {}
    for (const m of plan.materias()) states[m.cod] = 'aprobada'
    const h = av(states).hitos
    expect(h.every((x) => x.ok && x.falta === 0)).toBe(true)
  })
})

describe('Avance · decidirAnio · el interruptor de año', () => {
  const primero = plan.codsDelAnio(1)

  it('con el año a medio marcar, el interruptor aprueba', () => {
    expect(av().decidirAnio(primero)).toBe('aprobada')
    expect(av({ [primero[0]]: 'aprobada' }).decidirAnio(primero)).toBe('aprobada')
    // 'cursando' NO alcanza: el año no está completo
    const casi: Record<string, Estado> = {}
    for (const c of primero) casi[c] = 'aprobada'
    casi[primero[0]] = 'cursando'
    expect(av(casi).decidirAnio(primero)).toBe('aprobada')
  })

  it('con el año entero aprobado, el interruptor lo deja en blanco', () => {
    const todas: Record<string, Estado> = {}
    for (const c of primero) todas[c] = 'aprobada'
    expect(av(todas).decidirAnio(primero)).toBe('pendiente')
  })

  it('no toca las optativas: quedan fuera de los códigos del año', () => {
    const opts = plan
      .materias()
      .filter((m) => m.year === 1 && plan.isOpt(m.cod))
      .map((m) => m.cod)
    for (const o of opts) expect(primero).not.toContain(o)
  })
})

describe('Avance · nombreDe', () => {
  it('usa el nombre custom de la optativa si está cargado', () => {
    expect(av({}, {}, { OPT1: 'Machine Learning' }).nombreDe('OPT1')).toBe('Machine Learning')
  })

  it('sin nombre custom, cae al nombre base de la optativa', () => {
    expect(av().nombreDe('OPT1')).toBe('Optativa I')
  })

  it('una materia normal siempre usa su nombre del plan', () => {
    expect(av({}, {}, { [FUNDAMENTOS]: 'Otro nombre' }).nombreDe(FUNDAMENTOS)).toBe(
      'Fundamentos de Informática',
    )
  })
})
