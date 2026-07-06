import { describe, it, expect } from 'vitest'
import { PLAN } from './plan'
import { CORREL } from './correlativas'

// Red de seguridad de los DATOS del plan. No prueba lógica: prueba que
// PLAN y CORREL estén bien cargados. Cuando se sumen materias o carreras,
// este archivo es el que atrapa un código mal tipeado o una previa fantasma.

/** Todos los códigos de materia que existen en el plan (lista plana). */
const todosLosCodigos = PLAN.flatMap((a) => a.cuatris.flatMap((q) => q.mats.map((m) => m.cod)))
const codigos = new Set(todosLosCodigos)

describe('integridad de datos · PLAN', () => {
  it('no tiene códigos de materia duplicados', () => {
    const conteo = new Map<string, number>()
    for (const c of todosLosCodigos) conteo.set(c, (conteo.get(c) ?? 0) + 1)
    const duplicados = [...conteo.entries()].filter(([, n]) => n > 1).map(([c]) => c)
    expect(duplicados).toEqual([])
  })

  it('ninguna materia tiene código o nombre vacío', () => {
    const mats = PLAN.flatMap((a) => a.cuatris.flatMap((q) => q.mats))
    const vacias = mats.filter((m) => !m.cod.trim() || !m.nom.trim())
    expect(vacias).toEqual([])
  })
})

describe('integridad de datos · CORREL', () => {
  it('cada materia con correlativas existe en el plan', () => {
    const inexistentes = Object.keys(CORREL).filter((cod) => !codigos.has(cod))
    expect(inexistentes).toEqual([])
  })

  it('cada correlativa previa existe en el plan', () => {
    const previasRotas = Object.entries(CORREL)
      .flatMap(([cod, previas]) => previas.map((previa) => ({ cod, previa })))
      .filter(({ previa }) => !codigos.has(previa))
    expect(previasRotas).toEqual([])
  })

  it('ninguna materia es correlativa de sí misma', () => {
    const autoreferencias = Object.entries(CORREL)
      .filter(([cod, previas]) => previas.includes(cod))
      .map(([cod]) => cod)
    expect(autoreferencias).toEqual([])
  })

  it('no hay previas duplicadas dentro de una misma materia', () => {
    const conRepetidas = Object.entries(CORREL)
      .filter(([, previas]) => new Set(previas).size !== previas.length)
      .map(([cod]) => cod)
    expect(conRepetidas).toEqual([])
  })

  it('no hay ciclos en el grafo de correlativas', () => {
    // DFS con marcado tri-estado: sin visitar / en proceso / listo.
    // Si al recorrer las previas topamos con una que está "en proceso",
    // volvimos sobre nuestros pasos → hay ciclo.
    const marca = new Map<string, 'proceso' | 'listo'>()
    const ciclos: string[] = []

    const visitar = (cod: string, camino: string[]): void => {
      marca.set(cod, 'proceso')
      for (const previa of CORREL[cod] ?? []) {
        if (marca.get(previa) === 'proceso') {
          ciclos.push([...camino, cod, previa].join(' → '))
        } else if (!marca.has(previa)) {
          visitar(previa, [...camino, cod])
        }
      }
      marca.set(cod, 'listo')
    }

    for (const cod of Object.keys(CORREL)) {
      if (!marca.has(cod)) visitar(cod, [])
    }
    expect(ciclos).toEqual([])
  })
})
