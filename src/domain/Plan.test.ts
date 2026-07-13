import { describe, it, expect } from 'vitest'
import { Plan, plan } from './Plan'
import type { PlanDef } from '../data/model'

// Grafo de juguete para probar la estructura sin depender del plan real:
//   A → B → C
//        └→ D
// (B necesita A; C y D necesitan B)
const def: PlanDef = {
  id: 'test',
  universidad: 'x',
  codigo: '0',
  anio: 2021,
  carrera: 'Carrera de Prueba',
  titulos: [{ nombre: 'Título de Prueba', hastaAnio: 2 }],
  materias: [
    { cod: 'A', nom: 'Materia A', anio: 1, cuatri: 1 },
    { cod: 'B', nom: 'Materia B', anio: 1, cuatri: 1 },
    { cod: 'C', nom: 'Materia C', anio: 2, cuatri: 1 },
    { cod: 'D', nom: 'Materia D', anio: 2, cuatri: 1, opt: true },
  ],
  correlativas: [
    { cod: 'B', requiere: 'A' },
    { cod: 'C', requiere: 'B' },
    { cod: 'D', requiere: 'B' },
  ],
}
const p = new Plan(def)

const orden = (s: Set<string>) => [...s].sort()

describe('Plan · estructura', () => {
  it('materias() aplana todas las materias con su ubicación', () => {
    const mats = p.materias()
    expect(mats.map((m) => m.cod)).toEqual(['A', 'B', 'C', 'D'])
    const c = mats.find((m) => m.cod === 'C')!
    expect(c.year).toBe(2)
    expect(c.cuatri).toBe(1)
    expect(c.yi).toBe(1)
    expect(c.ci).toBe(0)
  })

  it('nombre() devuelve el nombre, o el propio código si no existe', () => {
    expect(p.nombre('A')).toBe('Materia A')
    expect(p.nombre('ZZZ')).toBe('ZZZ')
  })

  it('carrera y títulos salen del PlanDef', () => {
    expect(p.carrera).toBe('Carrera de Prueba')
    expect(p.titulos()).toEqual([{ nombre: 'Título de Prueba', hastaAnio: 2 }])
  })
})

describe('Plan · correlativas directas', () => {
  it('antes() devuelve las previas directas', () => {
    expect(p.antes('C')).toEqual(['B'])
    expect(p.antes('A')).toEqual([])
  })

  it('despues() es el reverso de antes()', () => {
    expect(p.despues('B').sort()).toEqual(['C', 'D'])
    expect(p.despues('A')).toEqual(['B'])
    expect(p.despues('C')).toEqual([])
  })
})

describe('Plan · cadenas recursivas', () => {
  it('chainUp() junta todos los ancestros (lo que necesitás)', () => {
    expect(orden(p.chainUp('C'))).toEqual(['A', 'B'])
    expect(orden(p.chainUp('A'))).toEqual([])
  })

  it('chainDown() junta todos los descendientes (lo que habilita)', () => {
    expect(orden(p.chainDown('A'))).toEqual(['B', 'C', 'D'])
    expect(orden(p.chainDown('C'))).toEqual([])
  })

  it('chainUpLevels() da el nivel (distancia) más corto hacia arriba', () => {
    const niveles = p.chainUpLevels('C')
    expect(niveles.get('B')).toBe(1)
    expect(niveles.get('A')).toBe(2)
  })

  it('chainDownLevels() da el nivel más corto hacia abajo', () => {
    const niveles = p.chainDownLevels('A')
    expect(niveles.get('B')).toBe(1)
    expect(niveles.get('C')).toBe(2)
    expect(niveles.get('D')).toBe(2)
  })
})

describe('Plan · títulos por cuatrimestre', () => {
  // Como la Lic. en IA: el título intermedio cae tras el 1° cuatri del último año.
  //   Año 1: A (c1), B (c2) · Año 2: C (c1), D (c2)
  const def2: PlanDef = {
    ...def,
    titulos: [
      { nombre: 'Intermedio', hastaAnio: 2, hastaCuatri: 1 },
      { nombre: 'Final', hastaAnio: 2 },
    ],
    materias: [
      { cod: 'A', nom: 'Materia A', anio: 1, cuatri: 1 },
      { cod: 'B', nom: 'Materia B', anio: 1, cuatri: 2 },
      { cod: 'C', nom: 'Materia C', anio: 2, cuatri: 1 },
      { cod: 'D', nom: 'Materia D', anio: 2, cuatri: 2 },
    ],
    correlativas: [],
  }
  const p2 = new Plan(def2)

  it('un título a mitad de año cuelga de su cuatrimestre', () => {
    expect(p2.anios[1].cuatris[0].titulo).toBe('Intermedio')
    expect(p2.anios[1].cuatris[1].titulo).toBeUndefined()
  })

  it('un título de año completo cuelga del año, no de un cuatrimestre', () => {
    expect(p2.anios[1].titulo).toBe('Final')
    expect(p2.anios[0].titulo).toBeUndefined()
    expect(p2.anios[0].cuatris.every((q) => q.titulo === undefined)).toBe(true)
  })

  it('hastaCuatri en el último cuatrimestre del año equivale al año completo', () => {
    const p3 = new Plan({
      ...def2,
      titulos: [{ nombre: 'Final', hastaAnio: 2, hastaCuatri: 2 }],
    })
    expect(p3.anios[1].titulo).toBe('Final')
    expect(p3.anios[1].cuatris.every((q) => q.titulo === undefined)).toBe(true)
  })

  it('materiasHasta() corta por año y cuatrimestre inclusive', () => {
    const [intermedio, final] = def2.titulos
    expect(p2.materiasHasta(intermedio).map((m) => m.cod)).toEqual(['A', 'B', 'C'])
    expect(p2.materiasHasta(final).map((m) => m.cod)).toEqual(['A', 'B', 'C', 'D'])
  })
})

describe('Plan · clasificación por flags', () => {
  it('isOpt() usa el flag opt de la materia', () => {
    expect(p.isOpt('D')).toBe(true)
    expect(p.isOpt('A')).toBe(false)
  })

  it('isSpecial() cubre optativas y especiales (plan real)', () => {
    expect(plan.isOpt('OPT1')).toBe(true)
    expect(plan.isSpecial('OPT2')).toBe(true)
    expect(plan.isSpecial('PPS06')).toBe(true)
    expect(plan.isSpecial('3.4.100')).toBe(true)
    expect(plan.isSpecial('3.4.069')).toBe(false)
  })
})
