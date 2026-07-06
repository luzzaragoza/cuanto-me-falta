import { describe, it, expect } from 'vitest'
import { Plan, plan } from './Plan'
import type { AnioDef } from '../types'

// Grafo de juguete para probar la estructura sin depender del plan real:
//   A → B → C
//        └→ D
// (B necesita A; C y D necesitan B)
const anios: AnioDef[] = [
  { year: 1, cuatris: [{ n: 1, mats: [{ cod: 'A', nom: 'Materia A' }, { cod: 'B', nom: 'Materia B' }] }] },
  { year: 2, cuatris: [{ n: 1, mats: [{ cod: 'C', nom: 'Materia C' }, { cod: 'D', nom: 'Materia D' }] }] },
]
const correl: Record<string, string[]> = { B: ['A'], C: ['B'], D: ['B'] }
const p = new Plan(anios, correl)

const orden = (s: Set<string>) => [...s].sort()

describe('Plan · estructura', () => {
  it('materias() aplana todas las materias con su ubicación', () => {
    const mats = p.materias()
    expect(mats.map((m) => m.cod)).toEqual(['A', 'B', 'C', 'D'])
    const c = mats.find((m) => m.cod === 'C')!
    expect(c.year).toBe(2)
    expect(c.yi).toBe(1)
    expect(c.ci).toBe(0)
  })

  it('nombre() devuelve el nombre, o el propio código si no existe', () => {
    expect(p.nombre('A')).toBe('Materia A')
    expect(p.nombre('ZZZ')).toBe('ZZZ')
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

describe('Plan · clasificación de materias (plan real)', () => {
  it('isOpt() detecta solo las optativas OPT1/2/3', () => {
    expect(plan.isOpt('OPT1')).toBe(true)
    expect(plan.isOpt('OPT3')).toBe(true)
    expect(plan.isOpt('3.4.069')).toBe(false)
  })

  it('isSpecial() cubre optativas, PPS y Proyecto Final', () => {
    expect(plan.isSpecial('OPT2')).toBe(true)
    expect(plan.isSpecial('PPS06')).toBe(true)
    expect(plan.isSpecial('3.4.100')).toBe(true)
    expect(plan.isSpecial('3.4.069')).toBe(false)
  })
})
