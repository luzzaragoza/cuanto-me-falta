import { describe, it, expect } from 'vitest'
import { PLANES, PLAN_POR_DEFECTO, existePlan } from './planes'

// Red de seguridad de los DATOS. Valida CADA plan cargado (no solo el default):
// sin materias duplicadas, correlativas que apunten a códigos existentes, sin ciclos.
// Cuando el admin cargue más planes, esto atrapa un dato mal tipeado.

describe('integridad · registro de planes', () => {
  it('los ids de plan son únicos', () => {
    const ids = PLANES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('el plan por defecto existe en el registro', () => {
    expect(existePlan(PLAN_POR_DEFECTO)).toBe(true)
  })
})

for (const plan of PLANES) {
  describe(`integridad · ${plan.carrera} (${plan.codigo})`, () => {
    const codigos = new Set(plan.materias.map((m) => m.cod))

    it('no tiene códigos de materia duplicados', () => {
      const conteo = new Map<string, number>()
      for (const m of plan.materias) conteo.set(m.cod, (conteo.get(m.cod) ?? 0) + 1)
      const duplicados = [...conteo.entries()].filter(([, n]) => n > 1).map(([c]) => c)
      expect(duplicados).toEqual([])
    })

    it('ninguna materia tiene código o nombre vacío', () => {
      const vacias = plan.materias.filter((m) => !m.cod.trim() || !m.nom.trim())
      expect(vacias).toEqual([])
    })

    it('cada correlativa apunta a materias que existen en el plan', () => {
      const rotas = plan.correlativas.filter(
        (c) => !codigos.has(c.cod) || !codigos.has(c.requiere),
      )
      expect(rotas).toEqual([])
    })

    it('ninguna materia es correlativa de sí misma', () => {
      const auto = plan.correlativas.filter((c) => c.cod === c.requiere)
      expect(auto).toEqual([])
    })

    it('no hay correlativas duplicadas', () => {
      const vistas = new Set<string>()
      const duplicadas = plan.correlativas.filter((c) => {
        const k = `${c.cod}<-${c.requiere}`
        if (vistas.has(k)) return true
        vistas.add(k)
        return false
      })
      expect(duplicadas).toEqual([])
    })

    it('no hay ciclos en el grafo de correlativas', () => {
      const ady = new Map<string, string[]>()
      for (const c of plan.correlativas) {
        const arr = ady.get(c.cod) ?? []
        arr.push(c.requiere)
        ady.set(c.cod, arr)
      }
      const marca = new Map<string, 'proceso' | 'listo'>()
      const ciclos: string[] = []
      const visitar = (cod: string, camino: string[]): void => {
        marca.set(cod, 'proceso')
        for (const previa of ady.get(cod) ?? []) {
          if (marca.get(previa) === 'proceso') ciclos.push([...camino, cod, previa].join(' → '))
          else if (!marca.has(previa)) visitar(previa, [...camino, cod])
        }
        marca.set(cod, 'listo')
      }
      for (const cod of ady.keys()) if (!marca.has(cod)) visitar(cod, [])
      expect(ciclos).toEqual([])
    })

    it('los títulos apuntan a años y cuatrimestres que existen en el plan', () => {
      const anios = new Set(plan.materias.map((m) => m.anio))
      const cuatris = new Set(plan.materias.map((m) => `${m.anio}.${m.cuatri}`))
      const rotos = plan.titulos.filter(
        (t) =>
          !anios.has(t.hastaAnio) ||
          (t.hastaCuatri != null && !cuatris.has(`${t.hastaAnio}.${t.hastaCuatri}`)),
      )
      expect(rotos).toEqual([])
    })

    it('ninguna optativa participa de las correlativas', () => {
      // Invariante de RN-05: las optativas quedan exentas del chequeo de previas
      // (se habilitan por la oferta anual, no por correlativas). Si un plan futuro
      // necesita una optativa con correlativas, esto obliga a decidirlo a conciencia.
      const opts = new Set(plan.materias.filter((m) => m.opt).map((m) => m.cod))
      const tocanOpt = plan.correlativas.filter((c) => opts.has(c.cod) || opts.has(c.requiere))
      expect(tocanOpt).toEqual([])
    })

    it('toda correlativa apunta a un cuatrimestre anterior', () => {
      // Invariante del árbol (una fila por cuatrimestre): la previa vive SIEMPRE
      // más arriba, así toda flecha fluye hacia abajo. Un plan que lo rompa no es
      // cursable tal como está cargado (pedirían la materia y su previa a la vez).
      const idx = new Map(plan.materias.map((m) => [m.cod, (m.anio - 1) * 2 + (m.cuatri - 1)]))
      const alReves = plan.correlativas.filter((c) => idx.get(c.requiere)! >= idx.get(c.cod)!)
      expect(alReves).toEqual([])
    })
  })
}
