import { describe, it, expect } from 'vitest'
import { DB, Espejo, type Estado } from './types'
import { PlanDef } from './data/model'

// Fábricas mínimas: un plan con materias (cod, ¿optativa?) y una DB con marcas.
function plan(id: string, universidad: string, mats: Array<[string, boolean?]>): PlanDef {
  return PlanDef.exigir({
    id,
    universidad,
    codigo: '0000',
    anio: 2025,
    carrera: id,
    materias: mats.map(([cod, opt]) => ({ cod, nom: cod, anio: 1, cuatri: 1, opt })),
    correlativas: [],
    titulos: [],
  })
}
function db(states: Record<string, Estado> = {}, notas: Record<string, number> = {}): DB {
  return new DB(states, notas)
}

describe('Espejo · materias compartidas entre carreras', () => {
  const activo = plan('a', 'uade', [['M1'], ['M2'], ['OPT', true]])

  it('hereda estado y nota de una materia compartida en otra carrera', () => {
    const otro = plan('b', 'uade', [['M1'], ['M3']])
    const e = Espejo.deOtrasCarreras(activo, [{ plan: otro, db: db({ M1: 'aprobada', M3: 'aprobada' }, { M1: 9 }) }])
    expect(e.states).toEqual({ M1: 'aprobada' }) // M3 no es del plan activo
    expect(e.notas).toEqual({ M1: 9 })
  })

  it('el pendiente explícito de otra carrera no aparece en el espejo', () => {
    const otro = plan('b', 'uade', [['M1']])
    const e = Espejo.deOtrasCarreras(activo, [{ plan: otro, db: db({ M1: 'pendiente' }) }])
    expect(e.states).toEqual({})
  })

  it('las optativas quedan afuera aunque el código coincida', () => {
    // OPT es optativa en el plan activo; M2 es optativa en el otro plan
    const otro = plan('b', 'uade', [['OPT'], ['M2', true]])
    const e = Espejo.deOtrasCarreras(activo, [{ plan: otro, db: db({ OPT: 'aprobada', M2: 'aprobada' }) }])
    expect(e.states).toEqual({})
  })

  it('otra universidad no comparte materias aunque el código coincida', () => {
    const otro = plan('b', 'otra-uni', [['M1']])
    const e = Espejo.deOtrasCarreras(activo, [{ plan: otro, db: db({ M1: 'aprobada' }) }])
    expect(e.states).toEqual({})
  })

  it('entre varias carreras gana el estado más avanzado, en cualquier orden', () => {
    const b = plan('b', 'uade', [['M1']])
    const c = plan('c', 'uade', [['M1']])
    const cursando = { plan: b, db: db({ M1: 'cursando' as Estado }) }
    const aprobada = { plan: c, db: db({ M1: 'aprobada' as Estado }, { M1: 8 }) }
    expect(Espejo.deOtrasCarreras(activo, [cursando, aprobada]).states).toEqual({ M1: 'aprobada' })
    expect(Espejo.deOtrasCarreras(activo, [aprobada, cursando]).states).toEqual({ M1: 'aprobada' })
    expect(Espejo.deOtrasCarreras(activo, [cursando, aprobada]).notas).toEqual({ M1: 8 })
  })

  it('la nota acompaña al estado ganador: si el ganador no tiene, no queda la del otro', () => {
    const b = plan('b', 'uade', [['M1']])
    const c = plan('c', 'uade', [['M1']])
    const conNota = { plan: b, db: db({ M1: 'cursando' as Estado }, { M1: 7 }) }
    const sinNota = { plan: c, db: db({ M1: 'aprobada' as Estado }) }
    const e = Espejo.deOtrasCarreras(activo, [conNota, sinNota])
    expect(e.states).toEqual({ M1: 'aprobada' })
    expect(e.notas).toEqual({})
  })

  // Regresión de un bug real que el typecheck NO agarra (8-ago, lo encontró el e2e).
  // `state/store.ts` leía las otras carreras con `JSON.parse(raw) as DB`. El cast
  // compila —le dice al compilador "confiá"— pero lo que sale de `JSON.parse` es un
  // objeto PLANO sin métodos, así que `espejoDe` reventaba recién en el navegador con
  // "otro.db.nota is not a function". La lección: en la frontera va la factory, nunca
  // un cast.
  it('una DB que viene de JSON hay que rehidratarla antes de espejarla', () => {
    const otro = plan('b', 'uade', [['M1']])
    const guardada = db({ M1: 'aprobada' as Estado }, { M1: 9 })
    const plana = JSON.parse(JSON.stringify(guardada.aJSON())) as unknown

    // así entraba antes (con el cast): no tiene métodos y rompe
    expect(() => Espejo.deOtrasCarreras(activo, [{ plan: otro, db: plana as DB }])).toThrow()

    // así entra ahora
    const e = Espejo.deOtrasCarreras(activo, [{ plan: otro, db: DB.desde(plana) }])
    expect(e.states).toEqual({ M1: 'aprobada' })
    expect(e.notas).toEqual({ M1: 9 })
  })
})
