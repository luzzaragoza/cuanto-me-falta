import { describe, it, expect } from 'vitest'
import {
  agregarMateria,
  alternarPrevia,
  aniosDe,
  aPlanDef,
  codigoRepetido,
  dependenDe,
  editarMateria,
  elegiblesComoPosterior,
  elegiblesComoPrevia,
  guardable,
  moverMateria,
  ordenar,
  previasDe,
  quitarMateria,
  renombrarCodigo,
  resumen,
  type Borrador,
} from './editorPlan'
import { erroresDe } from './validarPlan'

/** Borrador de prueba: 4 materias en 3 cuatrimestres + 1 optativa + 1 correlativa. */
function base(): Borrador {
  return {
    id: 'test-plan',
    universidad: 'test-uni',
    codigo: '9999',
    anio: 2026,
    carrera: 'Carrera de Prueba',
    materias: [
      { cod: 'A', nom: 'Materia A', anio: 1, cuatri: 1, opt: false, especial: false, orden: 0 },
      { cod: 'B', nom: 'Materia B', anio: 1, cuatri: 2, opt: false, especial: false, orden: 1 },
      { cod: 'C', nom: 'Materia C', anio: 2, cuatri: 1, opt: false, especial: false, orden: 2 },
      { cod: 'OPT', nom: 'Optativa', anio: 2, cuatri: 1, opt: true, especial: false, orden: 3 },
    ],
    correlativas: [{ cod: 'B', requiere: 'A' }],
    titulos: [{ nombre: 'Técnico de Prueba', hastaAnio: 1 }],
  }
}

describe('editorPlan · el puente al dominio', () => {
  it('convierte el borrador en un PlanDef que el validador acepta', () => {
    expect(erroresDe(aPlanDef(base()))).toEqual([])
  })

  it('no manda claves de más: opt y especial solo cuando son true', () => {
    const p = aPlanDef(base())
    expect(p.materias[0]).toEqual({ cod: 'A', nom: 'Materia A', anio: 1, cuatri: 1 })
    expect(p.materias.find((m) => m.cod === 'OPT')).toMatchObject({ opt: true })
  })

  it('deja afuera las filas sin código todavía (y sus correlativas)', () => {
    const { borrador } = agregarMateria(base(), 2, 2)
    const conCorr = { ...borrador, correlativas: [...borrador.correlativas, { cod: '', requiere: 'A' }] }
    const p = aPlanDef(conCorr)
    expect(p.materias).toHaveLength(4) // la fila vacía no entra
    expect(p.correlativas).toEqual([{ cod: 'B', requiere: 'A' }])
    expect(erroresDe(p)).toEqual([]) // y el plan sigue publicable mientras se edita
  })

  it('recorta los espacios de códigos y nombres', () => {
    const b = editarMateria(base(), 0, { cod: '  A  ', nom: '  Materia A  ' })
    expect(aPlanDef(b).materias[0]).toMatchObject({ cod: 'A', nom: 'Materia A' })
  })

  it('ordena por año, cuatrimestre y orden', () => {
    const b = base()
    b.materias = [b.materias[2], b.materias[0], b.materias[1], b.materias[3]]
    expect(ordenar(b.materias).map((m) => m.cod)).toEqual(['A', 'B', 'C', 'OPT'])
  })
})

describe('editorPlan · correlativas que no se pueden cargar mal', () => {
  it('solo ofrece materias de cuatrimestres anteriores', () => {
    // C está en 2°/1°C: puede requerir A (1°/1°C) y B (1°/2°C), pero no a sí misma
    expect(elegiblesComoPrevia(base(), 'C').map((m) => m.cod)).toEqual(['A', 'B'])
  })

  it('no ofrece optativas como previa (RN-05)', () => {
    const b = base()
    b.materias.push({
      cod: 'D',
      nom: 'Materia D',
      anio: 3,
      cuatri: 1,
      opt: false,
      especial: false,
      orden: 4,
    })
    expect(elegiblesComoPrevia(b, 'D').map((m) => m.cod)).toEqual(['A', 'B', 'C'])
  })

  it('una materia del primer cuatrimestre no tiene ninguna elegible', () => {
    expect(elegiblesComoPrevia(base(), 'A')).toEqual([])
  })

  it('poner y sacar una previa es la misma acción', () => {
    let b = alternarPrevia(base(), 'C', 'A')
    expect(previasDe(b, 'C')).toEqual(['A'])
    b = alternarPrevia(b, 'C', 'A')
    expect(previasDe(b, 'C')).toEqual([])
  })

  it('dependenDe avisa a quién le rompés la cadena', () => {
    expect(dependenDe(base(), 'A')).toEqual(['B'])
    expect(dependenDe(base(), 'C')).toEqual([])
  })

  it('en la otra dirección ofrece solo cuatrimestres posteriores', () => {
    // A está en 1°/1°C: puede habilitar a B (1°/2°C) y C (2°/1°C), nunca a la optativa
    expect(elegiblesComoPosterior(base(), 'A').map((m) => m.cod)).toEqual(['B', 'C'])
  })

  it('una optativa no habilita nada (RN-05)', () => {
    expect(elegiblesComoPosterior(base(), 'OPT')).toEqual([])
  })

  it('la materia del último cuatrimestre no habilita nada', () => {
    expect(elegiblesComoPosterior(base(), 'C')).toEqual([])
  })

  it('las dos direcciones son inversas: conectar por una es lo mismo que por la otra', () => {
    const porAnterior = alternarPrevia(base(), 'C', 'A') // C necesita A
    const porPosterior = alternarPrevia(base(), 'C', 'A') // A habilita C = la misma arista
    expect(porAnterior.correlativas).toEqual(porPosterior.correlativas)
    expect(previasDe(porAnterior, 'C')).toEqual(['A'])
    expect(dependenDe(porPosterior, 'A')).toEqual(['B', 'C'])
  })

  it('lo que se carga con las elegibles siempre pasa el validador', () => {
    let b = base()
    for (const previa of elegiblesComoPrevia(b, 'C')) b = alternarPrevia(b, 'C', previa.cod)
    expect(erroresDe(aPlanDef(b))).toEqual([])
  })
})

describe('editorPlan · agregar, editar y borrar materias', () => {
  it('la fila nueva nace vacía y no se puede guardar hasta tener código y nombre', () => {
    const { borrador, orden } = agregarMateria(base(), 2, 2)
    const nueva = borrador.materias.find((m) => m.orden === orden)!
    expect(nueva).toMatchObject({ cod: '', nom: '', anio: 2, cuatri: 2, nueva: true })
    expect(guardable(nueva)).toBe(false)
    const lista = editarMateria(borrador, orden, { cod: 'D', nom: 'Materia D' })
    expect(guardable(lista.materias.find((m) => m.orden === orden)!)).toBe(true)
  })

  it('detecta código repetido sin acusar a la propia fila', () => {
    const b = base()
    expect(codigoRepetido(b, 'A', 0)).toBe(false) // es ella misma
    expect(codigoRepetido(b, 'A', 1)).toBe(true) // B no puede llamarse A
    expect(codigoRepetido(b, '  ', 1)).toBe(false) // vacío no cuenta
  })

  it('borrar una materia se lleva sus correlativas en los dos sentidos', () => {
    const b = quitarMateria(base(), 0) // borra A, que B requiere
    expect(b.materias.map((m) => m.cod)).toEqual(['B', 'C', 'OPT'])
    expect(b.correlativas).toEqual([])
    expect(erroresDe(aPlanDef(b))).toEqual([])
  })

  it('renombrar el código arrastra las correlativas', () => {
    const b = renombrarCodigo(base(), 0, 'A2')
    expect(b.materias[0].cod).toBe('A2')
    expect(b.correlativas).toEqual([{ cod: 'B', requiere: 'A2' }])
    expect(erroresDe(aPlanDef(b))).toEqual([])
  })

  it('renombrar a vacío no rompe el grafo (todavía se está tipeando)', () => {
    const b = renombrarCodigo(base(), 0, '')
    expect(b.correlativas).toEqual([{ cod: 'B', requiere: 'A' }])
  })
})

describe('editorPlan · mover una materia avisa qué se rompe', () => {
  it('mover una previa a después de su materia devuelve la correlativa rota', () => {
    // A (1°/1°C) es previa de B (1°/2°C). Si A se va a 3°/1°C, deja de ser previa válida.
    const { borrador, rotas } = moverMateria(base(), 0, 3, 1)
    expect(rotas).toEqual([{ cod: 'B', requiere: 'A' }])
    // y el validador coincide: el plan movido tiene ese error
    expect(erroresDe(aPlanDef(borrador)).map((e) => e.regla)).toContain('correlativa-no-anterior')
  })

  it('un movimiento válido no rompe nada', () => {
    const { rotas } = moverMateria(base(), 2, 3, 2) // C a 3°/2°C, sigue después de sus previas
    expect(rotas).toEqual([])
  })

  it('mover al mismo cuatrimestre que su previa también cuenta como roto', () => {
    const { rotas } = moverMateria(base(), 1, 1, 1) // B al mismo cuatri que A
    expect(rotas).toEqual([{ cod: 'B', requiere: 'A' }])
  })
})

describe('editorPlan · datos para el encabezado', () => {
  it('cuenta lo que hay, sin contar filas a medio escribir', () => {
    const { borrador } = agregarMateria(base(), 3, 1)
    expect(resumen(borrador)).toEqual({ materias: 4, correlativas: 1, titulos: 1 })
  })

  it('lista los años con materias', () => {
    expect(aniosDe(base())).toEqual([1, 2])
  })
})
