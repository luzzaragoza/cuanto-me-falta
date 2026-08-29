import { describe, it, expect } from 'vitest'
import { Borrador, MateriaEdit } from './editorPlan'
import { Validacion } from './validarPlan'
import { Correlativa, TituloPlan } from '../data/model'

/** Borrador de prueba: 4 materias en 3 cuatrimestres + 1 optativa + 1 correlativa. */
const mat = (
  cod: string,
  nom: string,
  anio: number,
  cuatri: number,
  orden: number,
  opt = false,
): MateriaEdit => new MateriaEdit({ cod, nom, anio, cuatri, opt, orden })

function base(): Borrador {
  return new Borrador({
    id: 'test-plan',
    universidad: 'test-uni',
    codigo: '9999',
    anio: 2026,
    carrera: 'Carrera de Prueba',
    materias: [
      mat('A', 'Materia A', 1, 1, 0),
      mat('B', 'Materia B', 1, 2, 1),
      mat('C', 'Materia C', 2, 1, 2),
      mat('OPT', 'Optativa', 2, 1, 3, true),
    ],
    correlativas: [new Correlativa('B', 'A')],
    titulos: [new TituloPlan('Técnico de Prueba', 1)],
  })
}

describe('Borrador · el puente al dominio', () => {
  it('convierte el borrador en un PlanDef que el validador acepta', () => {
    expect(new Validacion(base().aPlan()).errores).toEqual([])
  })

  it('no manda claves de más: opt y especial solo cuando son true', () => {
    const p = base().aPlan()
    expect(p.materias[0].aJSON()).toEqual({ cod: 'A', nom: 'Materia A', anio: 1, cuatri: 1 })
    expect(p.materias.find((m) => m.cod === 'OPT')).toMatchObject({ opt: true })
  })

  it('deja afuera las filas sin código todavía (y sus correlativas)', () => {
    const { borrador } = base().agregarMateria(2, 2)
    const conCorr = borrador.conCorrelativas([...borrador.correlativas, new Correlativa('', 'A')])
    const p = conCorr.aPlan()
    expect(p.materias).toHaveLength(4) // la fila vacía no entra
    expect(p.correlativas.map((c) => c.aJSON())).toEqual([{ cod: 'B', requiere: 'A' }])
    expect(new Validacion(p).errores).toEqual([]) // y el plan sigue publicable mientras se edita
  })

  it('recorta los espacios de códigos y nombres', () => {
    const b = base().editarMateria(0, { cod: '  A  ', nom: '  Materia A  ' })
    expect(b.aPlan().materias[0]).toMatchObject({ cod: 'A', nom: 'Materia A' })
  })

  it('ordena por año, cuatrimestre y orden', () => {
    const o = base()
    const b = o.conMaterias([o.materias[2], o.materias[0], o.materias[1], o.materias[3]])
    expect(b.ordenadas.map((m) => m.cod)).toEqual(['A', 'B', 'C', 'OPT'])
  })
})

describe('Borrador · correlativas que no se pueden cargar mal', () => {
  it('solo ofrece materias de cuatrimestres anteriores', () => {
    // C está en 2°/1°C: puede requerir A (1°/1°C) y B (1°/2°C), pero no a sí misma
    expect(base().elegiblesComoPrevia('C').map((m) => m.cod)).toEqual(['A', 'B'])
  })

  it('no ofrece optativas como previa (RN-05)', () => {
    const b = base().conMaterias([...base().materias, mat('D', 'Materia D', 3, 1, 4)])
    expect(b.elegiblesComoPrevia('D').map((m) => m.cod)).toEqual(['A', 'B', 'C'])
  })

  it('una materia del primer cuatrimestre no tiene ninguna elegible', () => {
    expect(base().elegiblesComoPrevia('A')).toEqual([])
  })

  // Lo que le falta a quien intenta conectar dos materias y "no pasa nada": el motivo.
  describe('por qué no se puede conectar', () => {
    it('explica el orden temporal en cada dirección', () => {
      const b = base()
      // C (2°/1°C) no puede tener como previa a algo posterior…
      expect(b.porQueNo('A', 'C', 'anterior')).toContain('antes')
      // …ni habilitar algo anterior
      expect(b.porQueNo('C', 'A', 'posterior')).toContain('después')
    })

    it('distingue "mismo cuatrimestre" de "está después"', () => {
      const b = base().conMaterias([...base().materias, mat('D', 'Materia D', 1, 1, 4)])
      expect(b.porQueNo('A', 'D', 'anterior')).toContain('mismo cuatrimestre')
    })

    it('no inventa un motivo cuando sí se puede', () => {
      expect(base().porQueNo('C', 'A', 'anterior')).toBeNull()
    })

    it('la misma materia consigo misma lo dice claro', () => {
      expect(base().porQueNo('A', 'A', 'anterior')).toBe('Es la misma materia.')
    })

    it('una optativa dice que lo es, y por qué (RN-05)', () => {
      expect(base().porQueNo('C', 'OPT', 'anterior')).toContain('optativa')
      expect(base().porQueNo('OPT', 'C', 'posterior')).toContain('optativa')
    })
  })

  it('poner y sacar una previa es la misma acción', () => {
    let b = base().alternarPrevia('C', 'A')
    expect(b.previasDe('C')).toEqual(['A'])
    b = b.alternarPrevia('C', 'A')
    expect(b.previasDe('C')).toEqual([])
  })

  it('dependenDe avisa a quién le rompés la cadena', () => {
    expect(base().dependenDe('A')).toEqual(['B'])
    expect(base().dependenDe('C')).toEqual([])
  })

  it('en la otra dirección ofrece solo cuatrimestres posteriores', () => {
    // A está en 1°/1°C: puede habilitar a B (1°/2°C) y C (2°/1°C), nunca a la optativa
    expect(base().elegiblesComoPosterior('A').map((m) => m.cod)).toEqual(['B', 'C'])
  })

  it('una optativa no habilita nada (RN-05)', () => {
    expect(base().elegiblesComoPosterior('OPT')).toEqual([])
  })

  it('la materia del último cuatrimestre no habilita nada', () => {
    expect(base().elegiblesComoPosterior('C')).toEqual([])
  })

  it('las dos direcciones son inversas: conectar por una es lo mismo que por la otra', () => {
    const porAnterior = base().alternarPrevia('C', 'A') // C necesita A
    const porPosterior = base().alternarPrevia('C', 'A') // A habilita C = la misma arista
    expect(porAnterior.correlativas).toEqual(porPosterior.correlativas)
    expect(porAnterior.previasDe('C')).toEqual(['A'])
    expect(porPosterior.dependenDe('A')).toEqual(['B', 'C'])
  })

  it('lo que se carga con las elegibles siempre pasa el validador', () => {
    let b = base()
    for (const previa of b.elegiblesComoPrevia('C')) b = b.alternarPrevia('C', previa.cod)
    expect(new Validacion(b.aPlan()).errores).toEqual([])
  })
})

describe('Borrador · agregar, editar y borrar materias', () => {
  it('la fila nueva nace vacía y no se puede guardar hasta tener código y nombre', () => {
    const { borrador, orden } = base().agregarMateria(2, 2)
    const nueva = borrador.materiaEn(orden)!
    expect(nueva).toMatchObject({ cod: '', nom: '', anio: 2, cuatri: 2, nueva: true })
    expect(nueva.guardable).toBe(false)
    const lista = borrador.editarMateria(orden, { cod: 'D', nom: 'Materia D' })
    expect(lista.materiaEn(orden)!.guardable).toBe(true)
  })

  it('detecta código repetido sin acusar a la propia fila', () => {
    const b = base()
    expect(b.codigoRepetido('A', 0)).toBe(false) // es ella misma
    expect(b.codigoRepetido('A', 1)).toBe(true) // B no puede llamarse A
    expect(b.codigoRepetido('  ', 1)).toBe(false) // vacío no cuenta
  })

  it('borrar una materia se lleva sus correlativas en los dos sentidos', () => {
    const b = base().quitarMateria(0) // borra A, que B requiere
    expect(b.materias.map((m) => m.cod)).toEqual(['B', 'C', 'OPT'])
    expect(b.correlativas).toEqual([])
    expect(new Validacion(b.aPlan()).errores).toEqual([])
  })

  it('renombrar el código arrastra las correlativas', () => {
    const b = base().renombrarCodigo(0, 'A2')
    expect(b.materias[0].cod).toBe('A2')
    expect(b.correlativas.map((c) => c.aJSON())).toEqual([{ cod: 'B', requiere: 'A2' }])
    expect(new Validacion(b.aPlan()).errores).toEqual([])
  })

  it('renombrar a vacío no rompe el grafo (todavía se está tipeando)', () => {
    const b = base().renombrarCodigo(0, '')
    expect(b.correlativas.map((c) => c.aJSON())).toEqual([{ cod: 'B', requiere: 'A' }])
  })
})

describe('Borrador · mover una materia avisa qué se rompe', () => {
  it('mover una previa a después de su materia devuelve la correlativa rota', () => {
    // A (1°/1°C) es previa de B (1°/2°C). Si A se va a 3°/1°C, deja de ser previa válida.
    const { borrador, rotas } = base().moverMateria(0, 3, 1)
    expect(rotas.map((c) => c.aJSON())).toEqual([{ cod: 'B', requiere: 'A' }])
    // y el validador coincide: el plan movido tiene ese error
    expect(new Validacion(borrador.aPlan()).errores.map((e) => e.regla)).toContain('correlativa-no-anterior')
  })

  it('un movimiento válido no rompe nada', () => {
    const { rotas } = base().moverMateria(2, 3, 2) // C a 3°/2°C, sigue después de sus previas
    expect(rotas).toEqual([])
  })

  it('mover al mismo cuatrimestre que su previa también cuenta como roto', () => {
    const { rotas } = base().moverMateria(1, 1, 1) // B al mismo cuatri que A
    expect(rotas.map((c) => c.aJSON())).toEqual([{ cod: 'B', requiere: 'A' }])
  })
})

describe('Borrador · datos para el encabezado', () => {
  it('cuenta lo que hay, sin contar filas a medio escribir', () => {
    const { borrador } = base().agregarMateria(3, 1)
    expect(borrador.resumen).toEqual({ materias: 4, correlativas: 1, titulos: 1 })
  })

  it('lista los años con materias', () => {
    expect(base().anios).toEqual([1, 2])
  })
})
