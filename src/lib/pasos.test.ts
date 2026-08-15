import { describe, it, expect } from 'vitest'
import { Borrador, MateriaEdit } from './editorPlan'
import { Validacion } from './validarPlan'
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

const pasosDe = (b: Borrador, sinPendientes = false): Pasos =>
  new Pasos(b, new Validacion(b.aPlan()), sinPendientes)

describe('Pasos · dónde estás y qué falta', () => {
  it('un plan sano tiene los tres pasos, en orden', () => {
    const l = pasosDe(sano()).lista
    expect(l.map((p) => p.n)).toEqual([1, 2, 3])
    expect(l.map((p) => p.titulo)).toEqual([
      'Cargá las materias',
      'Marcá qué necesita cada una',
      'Revisá y publicá',
    ])
  })

  it('cada paso lleva a su pestaña', () => {
    expect(pasosDe(sano()).lista.map((p) => p.pestania)).toEqual([
      'estructura',
      'correlativas',
      'titulos',
    ])
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

describe('Pasos · paso 3, publicar', () => {
  // Un plan recién creado dispara el error "no tiene ninguna materia". Es cierto, pero
  // como PASO 3 es ruido: no empezaste, no está roto. Arrancar con una alarma roja
  // desalienta y no dice nada que el paso 1 no diga mejor.
  it('un plan vacío NO muestra errores: muestra que todavía no empezaste', () => {
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
    const p3 = pasosDe(vacio).lista[2]
    expect(p3.estado).toBe('pendiente')
    expect(p3.detalle).toBe('Cuando termines de cargar')
  })

  it('con errores queda bloqueado y dice cuántos', () => {
    const roto = sano().alternarPrevia('A', 'C') // previa posterior en el tiempo
    const p3 = pasosDe(roto).lista[2]
    expect(p3.estado).toBe('bloqueado')
    expect(p3.detalle).toContain('1 error')
  })

  it('sin errores, está listo para publicar', () => {
    const p3 = pasosDe(sano()).lista[2]
    expect(p3.estado).toBe('enCurso')
    expect(p3.detalle).toBe('Listo para publicar')
  })

  it('si ya se publicó y no hay cambios, está hecho', () => {
    const p3 = pasosDe(sano(), true).lista[2]
    expect(p3.estado).toBe('listo')
    expect(p3.detalle).toBe('Los alumnos ya ven esta versión')
  })

  it('los avisos no bloquean, pero se cuentan', () => {
    const sinTitulos = sano().conTitulos([])
    const p3 = pasosDe(sinTitulos).lista[2]
    expect(p3.estado).toBe('enCurso')
    expect(p3.detalle).toContain('aviso')
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

    expect(pasosDe(sano()).actual.n).toBe(3)
  })

  it('con todo hecho, se queda en el último (no hay cuarto paso)', () => {
    expect(pasosDe(sano(), true).actual.n).toBe(3)
  })
})
