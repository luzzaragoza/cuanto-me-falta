import { describe, it, expect } from 'vitest'
import { MateriaPlan, PlanDef } from '../data/model'
import type { PlanJSON } from '../data/json'
import { Validacion, type Regla } from './validarPlan'

// Cada regla, probada con un plan roto A PROPÓSITO. Es la mitad que faltaba: los tests
// de integridad prueban que los planes reales están limpios, estos prueban que el
// chequeo sirve (si un invariante nunca se ve fallar, no sabemos si mide algo).

/** Plan mínimo válido, COMO JSON: cada caso pisa el campo que quiere romper. */
function base(): PlanJSON {
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

/**
 * El plan de prueba como objeto, pisando lo que haga falta.
 *
 * Va por `exigir()` a propósito: si un caso dejara de tener la FORMA de un plan (un
 * `anio` que es string, por ejemplo), revienta acá y se ve — en vez de disfrazarse de
 * "el validador encontró un error", que es justo lo que el test quiere medir.
 */
const plan = (over: Partial<PlanJSON> = {}): PlanDef => PlanDef.exigir({ ...base(), ...over })

/** Las materias del plan base, más las que sume el caso. */
const conMaterias = (...extras: PlanJSON['materias']): PlanJSON['materias'] => [
  ...base().materias,
  ...extras,
]

/** Reglas disparadas por un plan, en orden. */
const reglas = (p: PlanDef): Regla[] => new Validacion(p).reglas

describe('validarPlan · el plan base', () => {
  it('no reporta nada y es publicable', () => {
    expect(new Validacion(plan()).hallazgos).toEqual([])
    expect(new Validacion(plan()).esPublicable).toBe(true)
  })

  it('el índice de cuatrimestre ordena el tiempo de la carrera', () => {
    expect(MateriaPlan.indiceDe(1, 1)).toBe(0)
    expect(MateriaPlan.indiceDe(1, 2)).toBe(1)
    expect(MateriaPlan.indiceDe(2, 1)).toBe(2)
    expect(MateriaPlan.indiceDe(3, 2)).toBe(5)
  })

  it('la materia sabe su propia posición y quién va antes', () => {
    const a = new MateriaPlan('A', 'A', 1, 1)
    const c = new MateriaPlan('C', 'C', 2, 1)
    expect(a.indice).toBe(0)
    expect(c.indice).toBe(2)
    expect(a.anteriorA(c)).toBe(true)
    expect(c.anteriorA(a)).toBe(false)
  })
})

describe('validarPlan · errores de cabecera y estructura', () => {
  it('detecta cabecera incompleta y enumera qué falta', () => {
    const [h] = new Validacion(plan({ codigo: '  ', carrera: '', anio: 0 })).hallazgos
    expect(h.regla).toBe('plan-incompleto')
    expect(h.mensaje).toContain('código de plan')
    expect(h.mensaje).toContain('nombre de la carrera')
    expect(h.mensaje).toContain('año de vigencia')
  })

  it('un plan sin materias corta ahí (no ahoga con reglas derivadas)', () => {
    expect(reglas(plan({ materias: [], correlativas: [], titulos: [] }))).toEqual([
      'plan-incompleto',
    ])
  })

  it('detecta materias sin código, sin nombre o con cuatrimestre inválido', () => {
    const p = plan({
      materias: [
        { cod: 'A', nom: '', anio: 1, cuatri: 1 },
        { cod: 'B', nom: 'Materia B', anio: 0, cuatri: 3 },
        { cod: '', nom: 'Sin código', anio: 1, cuatri: 1 },
      ],
      correlativas: [],
    })
    const hs = new Validacion(p).hallazgos.filter((x) => x.regla === 'materia-invalida')
    expect(hs).toHaveLength(3)
    expect(hs[0].mensaje).toContain('sin nombre')
    expect(hs[1].mensaje).toContain('año inválido')
    expect(hs[1].mensaje).toContain('cuatrimestre inválido')
    expect(hs[2].cods).toEqual([]) // sin código no se puede resaltar
  })

  it('detecta un código de materia repetido', () => {
    const p = plan({ materias: conMaterias({ cod: 'A', nom: 'Otra A', anio: 2, cuatri: 2 }) })
    const [h] = new Validacion(p).errores
    expect(h.regla).toBe('materia-duplicada')
    expect(h.cods).toEqual(['A'])
  })
})

describe('validarPlan · errores de correlativas', () => {
  it('detecta una correlativa que apunta a una materia que no existe', () => {
    const [h] = new Validacion(plan({ correlativas: [{ cod: 'C', requiere: 'ZZZ' }] })).errores
    expect(h.regla).toBe('correlativa-inexistente')
    expect(h.mensaje).toContain('ZZZ')
  })

  it('detecta una materia correlativa de sí misma', () => {
    expect(new Validacion(plan({ correlativas: [{ cod: 'B', requiere: 'B' }] })).errores[0].regla).toBe(
      'auto-correlativa',
    )
  })

  it('detecta una correlativa repetida', () => {
    const p = plan({
      correlativas: [
        { cod: 'B', requiere: 'A' },
        { cod: 'B', requiere: 'A' },
      ],
    })
    expect(new Validacion(p).errores[0].regla).toBe('correlativa-duplicada')
  })

  it('detecta una correlativa que no está en un cuatrimestre anterior', () => {
    // A y B al revés: B (1°/2°C) pasa a ser previa de A (1°/1°C)
    const [h] = new Validacion(plan({ correlativas: [{ cod: 'A', requiere: 'B' }] })).errores
    expect(h.regla).toBe('correlativa-no-anterior')
    expect(h.cods).toEqual(['A', 'B'])
  })

  it('detecta dos materias del MISMO cuatrimestre como correlativas', () => {
    const p = plan({
      materias: conMaterias({ cod: 'D', nom: 'Materia D', anio: 1, cuatri: 1 }),
      correlativas: [{ cod: 'D', requiere: 'A' }],
    })
    expect(reglas(p)).toContain('correlativa-no-anterior')
  })

  it('detecta un círculo de correlativas', () => {
    // C←B, B←A y A←C: el círculo existe aunque cada arista respete el orden temporal
    const p = plan({
      correlativas: [
        { cod: 'C', requiere: 'B' },
        { cod: 'B', requiere: 'A' },
        { cod: 'A', requiere: 'C' },
      ],
    })
    const ciclos = new Validacion(p).hallazgos.filter((x) => x.regla === 'ciclo')
    expect(ciclos).toHaveLength(1)
    expect(ciclos[0].mensaje).toContain('→')
  })

  it('detecta una optativa metida en las correlativas (RN-05)', () => {
    const p = plan({
      materias: conMaterias({ cod: 'OPT1', nom: 'Optativa', anio: 2, cuatri: 2, opt: true }),
      correlativas: [...base().correlativas, { cod: 'OPT1', requiere: 'A' }],
    })
    expect(reglas(p)).toContain('optativa-en-correlativas')
  })
})

describe('validarPlan · títulos', () => {
  it('detecta un título hasta un año que el plan no tiene', () => {
    const [h] = new Validacion(plan({ titulos: [{ nombre: 'Licenciado', hastaAnio: 5 }] })).errores
    expect(h.regla).toBe('titulo-invalido')
    expect(h.mensaje).toContain('5° año')
  })

  it('detecta un título hasta un cuatrimestre que el plan no tiene', () => {
    const p = plan({ titulos: [{ nombre: 'Técnico', hastaAnio: 2, hastaCuatri: 2 }] })
    expect(new Validacion(p).errores[0].regla).toBe('titulo-invalido')
  })

  it('acepta un título a mitad de año cuando ese cuatrimestre existe', () => {
    expect(new Validacion(plan({ titulos: [{ nombre: 'Técnico', hastaAnio: 1, hastaCuatri: 2 }] })).errores).toEqual(
      [],
    )
  })

  it('detecta un título sin nombre', () => {
    expect(new Validacion(plan({ titulos: [{ nombre: '   ', hastaAnio: 1 }] })).errores[0].regla).toBe(
      'titulo-invalido',
    )
  })

  it('el título sabe qué materias abarca', () => {
    const [t] = plan({ titulos: [{ nombre: 'T', hastaAnio: 2, hastaCuatri: 1 }] }).titulos
    expect(t.incluye(1, 1)).toBe(true) // año anterior completo
    expect(t.incluye(1, 2)).toBe(true)
    expect(t.incluye(2, 1)).toBe(true) // el corte, inclusive
    expect(t.incluye(2, 2)).toBe(false) // pasado el corte
    expect(t.incluye(3, 1)).toBe(false)
  })
})

describe('validarPlan · avisos (no bloquean)', () => {
  it('avisa si el plan no otorga ningún título, pero es publicable', () => {
    const p = plan({ titulos: [] })
    expect(reglas(p)).toEqual(['sin-titulos'])
    expect(new Validacion(p).esPublicable).toBe(true)
  })

  it('avisa si dos materias comparten el nombre', () => {
    const mats = base().materias
    mats[1] = { cod: 'B', nom: 'materia a', anio: 1, cuatri: 2 } // igual salvo mayúsculas
    const [h] = new Validacion(plan({ materias: mats })).hallazgos
    expect(h.regla).toBe('nombre-duplicado')
    expect(h.severidad).toBe('aviso')
    expect(h.cods).toEqual(['A', 'B'])
  })

  it('avisa si el plan saltea un año entero', () => {
    const p = plan({ materias: conMaterias({ cod: 'E', nom: 'Materia E', anio: 4, cuatri: 1 }) })
    const avisos = new Validacion(p).hallazgos.filter((x) => x.regla === 'anio-sin-materias')
    expect(avisos.map((a) => a.mensaje)).toEqual([
      'El plan salta el 3° año: no tiene ninguna materia.',
    ])
  })

  it('un plan con avisos y sin errores se puede publicar', () => {
    const p = plan({
      titulos: [],
      materias: conMaterias({ cod: 'E', nom: 'Materia E', anio: 4, cuatri: 1 }),
    })
    expect(new Validacion(p).errores).toEqual([])
    expect(new Validacion(p).esPublicable).toBe(true)
  })
})
