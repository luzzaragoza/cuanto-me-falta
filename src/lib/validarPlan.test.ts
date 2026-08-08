import { describe, it, expect } from 'vitest'
import type { PlanDef } from '../data/model'
import { validarPlan, erroresDe, esPublicable, indiceCuatri, type Regla } from './validarPlan'

// Cada regla, probada con un plan roto A PROPÓSITO. Es la mitad que faltaba: los tests
// de integridad prueban que los planes reales están limpios, estos prueban que el
// chequeo sirve (si un invariante nunca se ve fallar, no sabemos si mide algo).

/** Plan mínimo válido: 3 materias en 3 cuatrimestres, 1 correlativa, 1 título. */
function planBase(): PlanDef {
  return {
    id: 'test-plan',
    universidad: 'test-uni',
    codigo: '9999',
    anio: 2026,
    carrera: 'Carrera de Prueba',
    materias: [
      { cod: 'A', nom: 'Materia A', anio: 1, cuatri: 1 },
      { cod: 'B', nom: 'Materia B', anio: 1, cuatri: 2 },
      { cod: 'C', nom: 'Materia C', anio: 2, cuatri: 1 },
    ],
    correlativas: [{ cod: 'B', requiere: 'A' }],
    titulos: [{ nombre: 'Técnico de Prueba', hastaAnio: 1 }],
  }
}

/** Reglas disparadas por un plan, en orden. */
const reglas = (plan: PlanDef): Regla[] => validarPlan(plan).map((x) => x.regla)

describe('validarPlan · el plan base', () => {
  it('no reporta nada y es publicable', () => {
    expect(validarPlan(planBase())).toEqual([])
    expect(esPublicable(planBase())).toBe(true)
  })

  it('indiceCuatri ordena el tiempo de la carrera', () => {
    expect(indiceCuatri(1, 1)).toBe(0)
    expect(indiceCuatri(1, 2)).toBe(1)
    expect(indiceCuatri(2, 1)).toBe(2)
    expect(indiceCuatri(3, 2)).toBe(5)
  })
})

describe('validarPlan · errores de cabecera y estructura', () => {
  it('detecta cabecera incompleta y enumera qué falta', () => {
    const p = { ...planBase(), codigo: '  ', carrera: '', anio: 0 }
    const [h] = validarPlan(p)
    expect(h.regla).toBe('plan-incompleto')
    expect(h.mensaje).toContain('código de plan')
    expect(h.mensaje).toContain('nombre de la carrera')
    expect(h.mensaje).toContain('año de vigencia')
  })

  it('un plan sin materias corta ahí (no ahoga con reglas derivadas)', () => {
    const p: PlanDef = { ...planBase(), materias: [], correlativas: [], titulos: [] }
    expect(reglas(p)).toEqual(['plan-incompleto'])
  })

  it('detecta materias sin código, sin nombre o con cuatrimestre inválido', () => {
    const p = planBase()
    p.materias = [
      { cod: 'A', nom: '', anio: 1, cuatri: 1 },
      { cod: 'B', nom: 'Materia B', anio: 0, cuatri: 3 },
      { cod: '', nom: 'Sin código', anio: 1, cuatri: 1 },
    ]
    p.correlativas = []
    const hs = validarPlan(p).filter((x) => x.regla === 'materia-invalida')
    expect(hs).toHaveLength(3)
    expect(hs[0].mensaje).toContain('sin nombre')
    expect(hs[1].mensaje).toContain('año inválido')
    expect(hs[1].mensaje).toContain('cuatrimestre inválido')
    expect(hs[2].cods).toEqual([]) // sin código no se puede resaltar
  })

  it('detecta un código de materia repetido', () => {
    const p = planBase()
    p.materias.push({ cod: 'A', nom: 'Otra A', anio: 2, cuatri: 2 })
    const [h] = erroresDe(p)
    expect(h.regla).toBe('materia-duplicada')
    expect(h.cods).toEqual(['A'])
  })
})

describe('validarPlan · errores de correlativas', () => {
  it('detecta una correlativa que apunta a una materia que no existe', () => {
    const p = planBase()
    p.correlativas = [{ cod: 'C', requiere: 'ZZZ' }]
    const [h] = erroresDe(p)
    expect(h.regla).toBe('correlativa-inexistente')
    expect(h.mensaje).toContain('ZZZ')
  })

  it('detecta una materia correlativa de sí misma', () => {
    const p = planBase()
    p.correlativas = [{ cod: 'B', requiere: 'B' }]
    expect(erroresDe(p)[0].regla).toBe('auto-correlativa')
  })

  it('detecta una correlativa repetida', () => {
    const p = planBase()
    p.correlativas = [
      { cod: 'B', requiere: 'A' },
      { cod: 'B', requiere: 'A' },
    ]
    expect(erroresDe(p)[0].regla).toBe('correlativa-duplicada')
  })

  it('detecta una correlativa que no está en un cuatrimestre anterior', () => {
    const p = planBase()
    // A y B al revés: B (1°/2°C) pasa a ser previa de A (1°/1°C)
    p.correlativas = [{ cod: 'A', requiere: 'B' }]
    const [h] = erroresDe(p)
    expect(h.regla).toBe('correlativa-no-anterior')
    expect(h.cods).toEqual(['A', 'B'])
  })

  it('detecta dos materias del MISMO cuatrimestre como correlativas', () => {
    const p = planBase()
    p.materias.push({ cod: 'D', nom: 'Materia D', anio: 1, cuatri: 1 })
    p.correlativas = [{ cod: 'D', requiere: 'A' }]
    expect(reglas(p)).toContain('correlativa-no-anterior')
  })

  it('detecta un círculo de correlativas', () => {
    const p = planBase()
    p.materias = [
      { cod: 'A', nom: 'A', anio: 1, cuatri: 1 },
      { cod: 'B', nom: 'B', anio: 1, cuatri: 2 },
      { cod: 'C', nom: 'C', anio: 2, cuatri: 1 },
    ]
    // C←B, B←A y A←C: el círculo existe aunque cada arista respete el orden temporal
    p.correlativas = [
      { cod: 'C', requiere: 'B' },
      { cod: 'B', requiere: 'A' },
      { cod: 'A', requiere: 'C' },
    ]
    const ciclos = validarPlan(p).filter((x) => x.regla === 'ciclo')
    expect(ciclos).toHaveLength(1)
    expect(ciclos[0].mensaje).toContain('→')
  })

  it('detecta una optativa metida en las correlativas (RN-05)', () => {
    const p = planBase()
    p.materias.push({ cod: 'OPT1', nom: 'Optativa', anio: 2, cuatri: 2, opt: true })
    p.correlativas.push({ cod: 'OPT1', requiere: 'A' })
    expect(reglas(p)).toContain('optativa-en-correlativas')
  })
})

describe('validarPlan · títulos', () => {
  it('detecta un título hasta un año que el plan no tiene', () => {
    const p = planBase()
    p.titulos = [{ nombre: 'Licenciado', hastaAnio: 5 }]
    const [h] = erroresDe(p)
    expect(h.regla).toBe('titulo-invalido')
    expect(h.mensaje).toContain('5° año')
  })

  it('detecta un título hasta un cuatrimestre que el plan no tiene', () => {
    const p = planBase()
    p.titulos = [{ nombre: 'Técnico', hastaAnio: 2, hastaCuatri: 2 }]
    expect(erroresDe(p)[0].regla).toBe('titulo-invalido')
  })

  it('acepta un título a mitad de año cuando ese cuatrimestre existe', () => {
    const p = planBase()
    p.titulos = [{ nombre: 'Técnico', hastaAnio: 1, hastaCuatri: 2 }]
    expect(erroresDe(p)).toEqual([])
  })

  it('detecta un título sin nombre', () => {
    const p = planBase()
    p.titulos = [{ nombre: '   ', hastaAnio: 1 }]
    expect(erroresDe(p)[0].regla).toBe('titulo-invalido')
  })
})

describe('validarPlan · avisos (no bloquean)', () => {
  it('avisa si el plan no otorga ningún título, pero es publicable', () => {
    const p = planBase()
    p.titulos = []
    expect(reglas(p)).toEqual(['sin-titulos'])
    expect(esPublicable(p)).toBe(true)
  })

  it('avisa si dos materias comparten el nombre', () => {
    const p = planBase()
    p.materias[1] = { cod: 'B', nom: 'materia a', anio: 1, cuatri: 2 } // igual salvo mayúsculas
    const [h] = validarPlan(p)
    expect(h.regla).toBe('nombre-duplicado')
    expect(h.severidad).toBe('aviso')
    expect(h.cods).toEqual(['A', 'B'])
  })

  it('avisa si el plan saltea un año entero', () => {
    const p = planBase()
    p.materias.push({ cod: 'E', nom: 'Materia E', anio: 4, cuatri: 1 })
    const avisos = validarPlan(p).filter((x) => x.regla === 'anio-sin-materias')
    expect(avisos.map((a) => a.mensaje)).toEqual([
      'El plan salta el 3° año: no tiene ninguna materia.',
    ])
  })

  it('un plan con avisos y sin errores se puede publicar', () => {
    const p = planBase()
    p.titulos = []
    p.materias.push({ cod: 'E', nom: 'Materia E', anio: 4, cuatri: 1 })
    expect(erroresDe(p)).toEqual([])
    expect(esPublicable(p)).toBe(true)
  })
})
