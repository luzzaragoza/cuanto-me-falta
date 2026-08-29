import { describe, it, expect } from 'vitest'
import { Correlativa, TituloPlan, type PlanDef } from '../data/model'
import { Diff } from './cambios'
import { Borrador, MateriaEdit } from './editorPlan'

const mat = (cod: string, nom: string, anio: number, cuatri: number, orden: number): MateriaEdit =>
  new MateriaEdit({ cod, nom, anio, cuatri, orden })

function borrador(): Borrador {
  return new Borrador({
    id: 'p',
    universidad: 'u',
    codigo: '100',
    anio: 2026,
    carrera: 'Carrera',
    materias: [
      mat('A', 'Materia A', 1, 1, 0),
      mat('B', 'Materia B', 1, 2, 1),
      mat('C', 'Materia C', 2, 1, 2),
    ],
    correlativas: [new Correlativa('B', 'A')],
    titulos: [new TituloPlan('Técnico', 1)],
  })
}

/** La foto publicada = el borrador sin tocar. */
const publicado = (): PlanDef => borrador().aPlan()

/** Deshace y devuelve el borrador resultante, para comparar con el publicado. */
function deshacerTodo(b: Borrador): Borrador {
  const pub = publicado()
  let actual = b
  for (const c of new Diff(pub, actual).cambios) {
    if (c.reversible) actual = new Diff(pub, actual).deshacer(c).borrador
  }
  return actual
}

describe('cambios · sin cambios', () => {
  it('un borrador igual a lo publicado no reporta nada', () => {
    expect(new Diff(publicado(), borrador()).cambios).toEqual([])
    expect(new Diff(publicado(), borrador()).hay).toBe(false)
  })

  it('un plan que nunca se publicó lo dice, y no ofrece deshacer', () => {
    const [c] = new Diff(null, borrador()).cambios
    expect(c.tipo).toBe('sin-publicar')
    expect(c.reversible).toBe(false)
    expect(c.detalle).toContain('3 materias')
  })
})

describe('cambios · qué van a ver los alumnos', () => {
  it('detecta una materia nueva', () => {
    const { borrador: b, orden } = borrador().agregarMateria(2, 2)
    const conDatos = b.editarMateria(orden, { cod: 'D', nom: 'Materia D' })
    const [c] = new Diff(publicado(), conDatos).cambios
    expect(c.tipo).toBe('materia-nueva')
    expect(c.titulo).toBe('Materia D')
    expect(c.detalle).toContain('2° año · 2° cuatri')
  })

  it('detecta una materia borrada', () => {
    const [c] = new Diff(publicado(), borrador().quitarMateria(2)).cambios
    expect(c.tipo).toBe('materia-borrada')
    expect(c.titulo).toBe('Materia C')
  })

  it('detecta el renombre y dice el antes y el después', () => {
    const b = borrador().editarMateria(0, { nom: 'Materia A corregida' })
    const [c] = new Diff(publicado(), b).cambios
    expect(c.tipo).toBe('materia-editada')
    // el antes/después va ESTRUCTURADO: la pantalla lo enfrenta, no parsea un string
    expect(c.partes).toEqual([
      { campo: 'nombre', antes: 'Materia A', despues: 'Materia A corregida' },
    ])
  })

  it('detecta que una materia se movió de cuatrimestre', () => {
    const b = borrador().editarMateria(2, { anio: 3, cuatri: 2 })
    const [c] = new Diff(publicado(), b).cambios
    expect(c.partes).toEqual([
      { campo: 'ubicación', antes: '2° año · 1° cuatri', despues: '3° año · 2° cuatri' },
    ])
  })

  it('detecta que pasó a ser optativa', () => {
    const b = borrador().editarMateria(2, { opt: true })
    const [c] = new Diff(publicado(), b).cambios
    expect(c.partes).toEqual([{ campo: 'optativa', antes: 'no', despues: 'sí' }])
  })

  it('detecta una correlativa nueva y una quitada, con nombres', () => {
    let b = borrador().alternarPrevia('C', 'A') // nueva
    b = b.alternarPrevia('B', 'A') // quita la que estaba
    const cs = new Diff(publicado(), b).cambios
    expect(cs.map((c) => c.tipo).sort()).toEqual(['correlativa-borrada', 'correlativa-nueva'])
    expect(cs.find((c) => c.tipo === 'correlativa-nueva')!.titulo).toBe(
      'Materia C necesita Materia A',
    )
    expect(cs.find((c) => c.tipo === 'correlativa-borrada')!.titulo).toContain(
      'Materia B ya no necesita Materia A',
    )
  })

  it('detecta cambios en la cabecera', () => {
    const b = borrador().conCabecera({ codigo: '100', carrera: 'Otra Carrera', anio: 2027 })
    const [c] = new Diff(publicado(), b).cambios
    expect(c.tipo).toBe('cabecera')
    expect(c.partes).toEqual([
      { campo: 'nombre', antes: 'Carrera', despues: 'Otra Carrera' },
      { campo: 'año', antes: '2026', despues: '2027' },
    ])
  })

  it('detecta cambios en los títulos', () => {
    const b = borrador().conTitulos([])
    const [c] = new Diff(publicado(), b).cambios
    expect(c.tipo).toBe('titulos')
    expect(c.detalle).toContain('1 → 0')
  })

  it('varios cambios a la vez salen todos', () => {
    let b = borrador().editarMateria(0, { nom: 'A2' })
    b = b.alternarPrevia('C', 'A')
    b = b.quitarMateria(1) // borra B, y con ella su correlativa
    const cs = new Diff(publicado(), b).cambios
    expect(cs.map((c) => c.tipo).sort()).toEqual([
      'correlativa-borrada',
      'correlativa-nueva',
      'materia-borrada',
      'materia-editada',
    ])
  })
})

describe('cambios · deshacer', () => {
  it('deshacer una materia nueva se la lleva con sus correlativas', () => {
    const { borrador: b1, orden } = borrador().agregarMateria(2, 2)
    const b2 = b1.editarMateria(orden, { cod: 'D', nom: 'Materia D' })
    const b3 = b2.alternarPrevia('D', 'A')
    const pub = publicado()
    const nueva = new Diff(pub, b3).cambios.find((c) => c.tipo === 'materia-nueva')!
    const { borrador: r, guardar } = new Diff(pub, b3).deshacer(nueva)
    expect(r.materias.map((m) => m.cod)).toEqual(['A', 'B', 'C'])
    expect(r.correlativas).toEqual([{ cod: 'B', requiere: 'A' }])
    expect(guardar).toEqual({ que: 'materia-borrar', cod: 'D' })
  })

  it('deshacer una materia borrada la trae de vuelta como estaba', () => {
    const b = borrador().quitarMateria(2)
    const pub = publicado()
    const c = new Diff(pub, b).cambios[0]
    const { borrador: r, guardar } = new Diff(pub, b).deshacer(c)
    expect(r.materias.find((m) => m.cod === 'C')).toMatchObject({
      nom: 'Materia C',
      anio: 2,
      cuatri: 1,
    })
    expect(guardar).toEqual({ que: 'materia', cod: 'C' })
  })

  it('deshacer una edición restaura todos los campos, no solo el que se ve', () => {
    let b = borrador().editarMateria(2, { nom: 'Cambiada', anio: 4, cuatri: 2, opt: true })
    const pub = publicado()
    const c = new Diff(pub, b).cambios[0]
    b = new Diff(pub, b).deshacer(c).borrador
    expect(b.materias.find((m) => m.cod === 'C')).toMatchObject({
      nom: 'Materia C',
      anio: 2,
      cuatri: 1,
      opt: false,
    })
  })

  it('deshacer una correlativa nueva y una quitada', () => {
    const pub = publicado()
    const conNueva = borrador().alternarPrevia('C', 'A')
    const cn = new Diff(pub, conNueva).cambios[0]
    expect(new Diff(pub, conNueva).deshacer(cn).borrador.correlativas).toEqual([
      { cod: 'B', requiere: 'A' },
    ])

    const sinLaVieja = borrador().alternarPrevia('B', 'A')
    const cb = new Diff(pub, sinLaVieja).cambios[0]
    expect(new Diff(pub, sinLaVieja).deshacer(cb).borrador.correlativas).toEqual([
      { cod: 'B', requiere: 'A' },
    ])
  })

  it('deshacer TODOS los cambios deja el borrador igual a lo publicado', () => {
    let b = borrador().editarMateria(0, { nom: 'A2', anio: 3, cuatri: 2 })
    b = b.alternarPrevia('C', 'A')
    b = b.quitarMateria(1)
    b = b.conCabecera({ codigo: b.codigo, anio: b.anio, carrera: 'Otra' }).conTitulos([])
    const { borrador: agregada, orden } = b.agregarMateria(4, 1)
    b = agregada.editarMateria(orden, { cod: 'Z', nom: 'Zeta' })

    const vuelto = deshacerTodo(b)
    // misma foto: mismas materias, mismas correlativas, misma cabecera y títulos
    expect(new Diff(publicado(), vuelto).cambios).toEqual([])
  })
})
