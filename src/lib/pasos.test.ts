import { describe, it, expect } from 'vitest'
import { Borrador, MateriaEdit } from './editorPlan'
import { Correlativa, TituloPlan } from '../data/model'
import { Pasos } from './pasos'

const mat = (cod: string, nom: string, anio: number, cuatri: number, orden: number): MateriaEdit =>
  new MateriaEdit({ cod, nom, anio, cuatri, orden })

/** Un plan completo y sano: 3 materias en 2 años, 1 correlativa, 1 título. */
function sano(): Borrador {
  return new Borrador({
    id: 'p',
    universidad: 'u',
    codigo: '1',
    anio: 2026,
    carrera: 'Carrera',
    materias: [mat('A', 'Materia A', 1, 1, 0), mat('B', 'Materia B', 1, 2, 1), mat('C', 'Materia C', 2, 1, 2)],
    correlativas: [new Correlativa('B', 'A')],
    titulos: [new TituloPlan('Técnico', 1)],
  })
}

const pasosDe = (b: Borrador): Pasos => new Pasos(b)

describe('Pasos · dónde estás y qué falta', () => {
  // Publicar NO es un paso: fue el tercero por un rato y salió mal (brillaba "acá estás"
  // mientras la persona seguía en otra pestaña, y abría un panel encima de los otros dos).
  // Es algo que se hace cuando ya terminaste, así que es un botón aparte.
  it('son DOS pasos: los de la carga', () => {
    const l = pasosDe(sano()).lista
    expect(l.map((p) => p.n)).toEqual([1, 2])
    expect(l.map((p) => p.titulo)).toEqual(['Cargá las materias', 'Marcá qué necesita cada una'])
  })

  it('cada paso lleva a su pestaña', () => {
    expect(pasosDe(sano()).lista.map((p) => p.destino)).toEqual(['estructura', 'correlativas'])
  })
})

describe('Pasos · paso 1, las materias', () => {
  it('sin ninguna materia, está en curso y lo dice', () => {
    const vacio = new Borrador({
      id: 'p',
      universidad: 'u',
      codigo: '1',
      anio: 2026,
      carrera: 'Carrera',
      materias: [],
      correlativas: [],
      titulos: [],
    })
    const [p1] = pasosDe(vacio).lista
    expect(p1.estado).toBe('enCurso')
    expect(p1.detalle).toBe('Todavía no hay ninguna')
  })

  it('con las materias cargadas, dice cuántas y en cuántos años', () => {
    const [p1] = pasosDe(sano()).lista
    expect(p1.estado).toBe('listo')
    expect(p1.detalle).toBe('3 en 2 años')
  })

  it('una materia con código pero sin nombre lo deja en curso', () => {
    const b = sano().editarMateria(1, { nom: '' })
    const [p1] = pasosDe(b).lista
    expect(p1.estado).toBe('enCurso')
    expect(p1.detalle).toBe('1 quedó sin nombre')
  })

  it('las filas todavía vacías no cuentan como "sin nombre"', () => {
    // una fila recién agregada no tiene código ni nombre: se está tipeando, no está mal
    const b = sano().agregarMateria(1, 1).borrador
    const [p1] = pasosDe(b).lista
    expect(p1.estado).toBe('listo')
  })
})

describe('Pasos · paso 2, las correlativas', () => {
  it('sin materias todavía, ni se puede empezar', () => {
    const vacio = new Borrador({
      id: 'p',
      universidad: 'u',
      codigo: '1',
      anio: 2026,
      carrera: 'Carrera',
      materias: [],
      correlativas: [],
      titulos: [],
    })
    expect(pasosDe(vacio).lista[1].estado).toBe('pendiente')
  })

  it('cuenta las correlativas y cuántas materias tienen previas', () => {
    const p2 = pasosDe(sano()).lista[1]
    expect(p2.estado).toBe('listo')
    expect(p2.detalle).toBe('1 correlativa · 1 materia tiene previas')
  })

  it('el plural queda bien con más de una', () => {
    const b = sano().alternarPrevia('C', 'A')
    expect(pasosDe(b).lista[1].detalle).toBe('2 correlativas · 2 materias tienen previas')
  })

  // Lo importante de este paso: NO inventa un porcentaje. Las materias de primer año no
  // tienen previas y están bien así, con lo cual "23 de 40 completas" sería mentira.
  it('informa un conteo, nunca un porcentaje de avance', () => {
    const p2 = pasosDe(sano()).lista[1]
    expect(p2.detalle).not.toContain('%')
  })
})

describe('Pasos · en cuál conviene estar', () => {
  it('el actual es el primero que no está listo', () => {
    const vacio = new Borrador({
      id: 'p',
      universidad: 'u',
      codigo: '1',
      anio: 2026,
      carrera: 'Carrera',
      materias: [],
      correlativas: [],
      titulos: [],
    })
    expect(pasosDe(vacio).actual.n).toBe(1)

    const sinCorrelativas = sano().alternarPrevia('B', 'A') // saca la única
    expect(pasosDe(sinCorrelativas).actual.n).toBe(2)
  })

  it('con todo hecho, se queda en el último (no hay tercer paso)', () => {
    expect(pasosDe(sano()).actual.n).toBe(2)
  })
})
