import { describe, it, expect } from 'vitest'
import { Borrador, MateriaEdit } from './editorPlan'
import { Correlativa, TituloPlan } from '../data/model'
import { Historial, type Accion } from './historial'

const mat = (cod: string, nom: string, orden: number): MateriaEdit =>
  new MateriaEdit({ cod, nom, anio: 1, cuatri: 1, orden })

const borrador = (): Borrador =>
  new Borrador({
    id: 'p',
    universidad: 'u',
    codigo: '1',
    anio: 2026,
    carrera: 'Carrera',
    materias: [mat('A', 'Materia A', 0)],
    correlativas: [] as Correlativa[],
    titulos: [new TituloPlan('T', 1)],
  })

const accion = (etiqueta: string, antes = borrador()): Accion => ({
  etiqueta,
  antes,
  guardar: { que: 'materia', cod: 'A' },
})

describe('Historial · deshacer lo último', () => {
  it('arranca vacío y no deja deshacer', () => {
    const h = new Historial()
    expect(h.puedeDeshacer).toBe(false)
    expect(h.profundidad).toBe(0)
    expect(h.deshacer()).toBeNull()
  })

  it('apila y devuelve la última primero (LIFO)', () => {
    const h = new Historial().con(accion('borré una materia')).con(accion('moví una materia'))
    expect(h.profundidad).toBe(2)
    expect(h.ultima?.etiqueta).toBe('moví una materia')

    const r = h.deshacer()!
    expect(r.accion.etiqueta).toBe('moví una materia')
    expect(r.historial.ultima?.etiqueta).toBe('borré una materia')
    expect(r.historial.profundidad).toBe(1)
  })

  it('deshacer devuelve el borrador tal como estaba', () => {
    const antes = borrador()
    const h = new Historial().con(accion('agregué una materia', antes))
    expect(h.deshacer()!.accion.antes).toBe(antes)
  })

  it('es inmutable: apilar no toca el historial anterior', () => {
    const h1 = new Historial().con(accion('uno'))
    const h2 = h1.con(accion('dos'))
    expect(h1.profundidad).toBe(1)
    expect(h2.profundidad).toBe(2)
  })

  it('deshacer tampoco muta: el historial viejo sigue teniendo la acción', () => {
    const h1 = new Historial().con(accion('uno'))
    h1.deshacer()
    expect(h1.profundidad).toBe(1)
  })

  // Cada entrada guarda un borrador ENTERO. Sin tope, una sesión de carga larga
  // (cientos de acciones) se quedaría con medio plan duplicado cientos de veces.
  it('olvida las más viejas cuando se pasa del límite', () => {
    let h = new Historial([], 3)
    for (const n of ['uno', 'dos', 'tres', 'cuatro']) h = h.con(accion(n))
    expect(h.profundidad).toBe(3)
    expect(h.ultima?.etiqueta).toBe('cuatro')

    // la más vieja ('uno') ya no está: deshaciendo tres veces se llega a 'dos'
    const r1 = h.deshacer()!
    const r2 = r1.historial.deshacer()!
    const r3 = r2.historial.deshacer()!
    expect(r3.accion.etiqueta).toBe('dos')
    expect(r3.historial.puedeDeshacer).toBe(false)
  })

  it('se vacía al publicar: lo anterior es historia de otra versión', () => {
    const h = new Historial().con(accion('uno')).con(accion('dos'))
    expect(h.vaciado().puedeDeshacer).toBe(false)
    expect(h.vaciado().limite).toBe(h.limite)
  })

  it('lleva qué escritura hace falta para que la base vuelva atrás', () => {
    const h = new Historial().con(accion('borré una materia'))
    expect(h.ultima?.guardar).toEqual({ que: 'materia', cod: 'A' })
  })
})
