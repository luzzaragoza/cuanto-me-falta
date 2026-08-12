import { describe, it, expect } from 'vitest'
import type { PlanDef } from '../data/model'
import { deshacerCambio, diffPlanes, hayCambios } from './cambios'
import { agregarMateria, alternarPrevia, aPlanDef, editarMateria, quitarMateria, type Borrador } from './editorPlan'

function borrador(): Borrador {
  return {
    id: 'p',
    universidad: 'u',
    codigo: '100',
    anio: 2026,
    carrera: 'Carrera',
    materias: [
      { cod: 'A', nom: 'Materia A', anio: 1, cuatri: 1, opt: false, especial: false, orden: 0 },
      { cod: 'B', nom: 'Materia B', anio: 1, cuatri: 2, opt: false, especial: false, orden: 1 },
      { cod: 'C', nom: 'Materia C', anio: 2, cuatri: 1, opt: false, especial: false, orden: 2 },
    ],
    correlativas: [{ cod: 'B', requiere: 'A' }],
    titulos: [{ nombre: 'Técnico', hastaAnio: 1 }],
  }
}

/** La foto publicada = el borrador sin tocar. */
const publicado = (): PlanDef => aPlanDef(borrador())

/** Deshace y devuelve el borrador resultante, para comparar con el publicado. */
function deshacerTodo(b: Borrador): Borrador {
  const pub = publicado()
  let actual = b
  for (const c of diffPlanes(pub, aPlanDef(actual))) {
    if (c.reversible) actual = deshacerCambio(actual, pub, c).borrador
  }
  return actual
}

describe('cambios · sin cambios', () => {
  it('un borrador igual a lo publicado no reporta nada', () => {
    expect(diffPlanes(publicado(), aPlanDef(borrador()))).toEqual([])
    expect(hayCambios(publicado(), aPlanDef(borrador()))).toBe(false)
  })

  it('un plan que nunca se publicó lo dice, y no ofrece deshacer', () => {
    const [c] = diffPlanes(null, aPlanDef(borrador()))
    expect(c.tipo).toBe('sin-publicar')
    expect(c.reversible).toBe(false)
    expect(c.detalle).toContain('3 materias')
  })
})

describe('cambios · qué van a ver los alumnos', () => {
  it('detecta una materia nueva', () => {
    const { borrador: b, orden } = agregarMateria(borrador(), 2, 2)
    const conDatos = editarMateria(b, orden, { cod: 'D', nom: 'Materia D' })
    const [c] = diffPlanes(publicado(), aPlanDef(conDatos))
    expect(c.tipo).toBe('materia-nueva')
    expect(c.titulo).toBe('Materia nueva: Materia D')
    expect(c.detalle).toContain('2° año · 2° cuatri')
  })

  it('detecta una materia borrada', () => {
    const [c] = diffPlanes(publicado(), aPlanDef(quitarMateria(borrador(), 2)))
    expect(c.tipo).toBe('materia-borrada')
    expect(c.titulo).toBe('Materia borrada: Materia C')
  })

  it('detecta el renombre y dice el antes y el después', () => {
    const b = editarMateria(borrador(), 0, { nom: 'Materia A corregida' })
    const [c] = diffPlanes(publicado(), aPlanDef(b))
    expect(c.tipo).toBe('materia-editada')
    expect(c.detalle).toBe('nombre: "Materia A" → "Materia A corregida"')
  })

  it('detecta que una materia se movió de cuatrimestre', () => {
    const b = editarMateria(borrador(), 2, { anio: 3, cuatri: 2 })
    const [c] = diffPlanes(publicado(), aPlanDef(b))
    expect(c.detalle).toBe('movida de 2° año · 1° cuatri a 3° año · 2° cuatri')
  })

  it('detecta que pasó a ser optativa', () => {
    const b = editarMateria(borrador(), 2, { opt: true })
    const [c] = diffPlanes(publicado(), aPlanDef(b))
    expect(c.detalle).toBe('ahora es optativa')
  })

  it('detecta una correlativa nueva y una quitada, con nombres', () => {
    let b = alternarPrevia(borrador(), 'C', 'A') // nueva
    b = alternarPrevia(b, 'B', 'A') // quita la que estaba
    const cs = diffPlanes(publicado(), aPlanDef(b))
    expect(cs.map((c) => c.tipo).sort()).toEqual(['correlativa-borrada', 'correlativa-nueva'])
    expect(cs.find((c) => c.tipo === 'correlativa-nueva')!.titulo).toBe(
      'Correlativa nueva: Materia C necesita Materia A',
    )
    expect(cs.find((c) => c.tipo === 'correlativa-borrada')!.titulo).toContain(
      'Materia B ya no necesita Materia A',
    )
  })

  it('detecta cambios en la cabecera', () => {
    const b = { ...borrador(), carrera: 'Otra Carrera', anio: 2027 }
    const [c] = diffPlanes(publicado(), aPlanDef(b))
    expect(c.tipo).toBe('cabecera')
    expect(c.detalle).toContain('"Carrera" → "Otra Carrera"')
    expect(c.detalle).toContain('2026 → 2027')
  })

  it('detecta cambios en los títulos', () => {
    const b = { ...borrador(), titulos: [] }
    const [c] = diffPlanes(publicado(), aPlanDef(b))
    expect(c.tipo).toBe('titulos')
    expect(c.detalle).toContain('1 → 0')
  })

  it('varios cambios a la vez salen todos', () => {
    let b = editarMateria(borrador(), 0, { nom: 'A2' })
    b = alternarPrevia(b, 'C', 'A')
    b = quitarMateria(b, 1) // borra B, y con ella su correlativa
    const cs = diffPlanes(publicado(), aPlanDef(b))
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
    const { borrador: b1, orden } = agregarMateria(borrador(), 2, 2)
    const b2 = editarMateria(b1, orden, { cod: 'D', nom: 'Materia D' })
    const b3 = alternarPrevia(b2, 'D', 'A')
    const pub = publicado()
    const nueva = diffPlanes(pub, aPlanDef(b3)).find((c) => c.tipo === 'materia-nueva')!
    const { borrador: r, guardar } = deshacerCambio(b3, pub, nueva)
    expect(r.materias.map((m) => m.cod)).toEqual(['A', 'B', 'C'])
    expect(r.correlativas).toEqual([{ cod: 'B', requiere: 'A' }])
    expect(guardar).toEqual({ que: 'materia-borrar', cod: 'D' })
  })

  it('deshacer una materia borrada la trae de vuelta como estaba', () => {
    const b = quitarMateria(borrador(), 2)
    const pub = publicado()
    const c = diffPlanes(pub, aPlanDef(b))[0]
    const { borrador: r, guardar } = deshacerCambio(b, pub, c)
    expect(r.materias.find((m) => m.cod === 'C')).toMatchObject({
      nom: 'Materia C',
      anio: 2,
      cuatri: 1,
    })
    expect(guardar).toEqual({ que: 'materia', cod: 'C' })
  })

  it('deshacer una edición restaura todos los campos, no solo el que se ve', () => {
    let b = editarMateria(borrador(), 2, { nom: 'Cambiada', anio: 4, cuatri: 2, opt: true })
    const pub = publicado()
    const c = diffPlanes(pub, aPlanDef(b))[0]
    b = deshacerCambio(b, pub, c).borrador
    expect(b.materias.find((m) => m.cod === 'C')).toMatchObject({
      nom: 'Materia C',
      anio: 2,
      cuatri: 1,
      opt: false,
    })
  })

  it('deshacer una correlativa nueva y una quitada', () => {
    const pub = publicado()
    const conNueva = alternarPrevia(borrador(), 'C', 'A')
    const cn = diffPlanes(pub, aPlanDef(conNueva))[0]
    expect(deshacerCambio(conNueva, pub, cn).borrador.correlativas).toEqual([
      { cod: 'B', requiere: 'A' },
    ])

    const sinLaVieja = alternarPrevia(borrador(), 'B', 'A')
    const cb = diffPlanes(pub, aPlanDef(sinLaVieja))[0]
    expect(deshacerCambio(sinLaVieja, pub, cb).borrador.correlativas).toEqual([
      { cod: 'B', requiere: 'A' },
    ])
  })

  it('deshacer TODOS los cambios deja el borrador igual a lo publicado', () => {
    let b = editarMateria(borrador(), 0, { nom: 'A2', anio: 3, cuatri: 2 })
    b = alternarPrevia(b, 'C', 'A')
    b = quitarMateria(b, 1)
    b = { ...b, carrera: 'Otra', titulos: [] }
    const { borrador: agregada, orden } = agregarMateria(b, 4, 1)
    b = editarMateria(agregada, orden, { cod: 'Z', nom: 'Zeta' })

    const vuelto = deshacerTodo(b)
    // misma foto: mismas materias, mismas correlativas, misma cabecera y títulos
    expect(diffPlanes(publicado(), aPlanDef(vuelto))).toEqual([])
  })
})
