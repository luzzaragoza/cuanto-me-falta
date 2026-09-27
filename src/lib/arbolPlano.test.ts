import { describe, it, expect } from 'vitest'
import { PLANES } from '../data/planes'
import { Plan } from '../domain/Plan'
import {
  planoDe,
  reducirTransitivamente,
  NW,
  NH,
  GX,
  GY,
  PAD,
  TOP,
  type ParCorrelativa,
} from './arbolPlano'

// El plano del árbol, verificado contra los 4 planes REALES. Como el layout es una
// cuenta y no un motor, acá no hay invariantes geométricos aproximados: cada posición
// tiene una fórmula y se afirma exacta. Agregar una carrera es agregar datos, y estos
// tests la validan sola.

for (const def of PLANES) {
  describe(`arbolPlano · ${def.carrera}`, () => {
    const plan = new Plan(def)
    const plano = planoDe(plan)

    it('cada materia tiene su tarjeta, en la columna de su cuatrimestre', () => {
      expect(plano.nodos).toHaveLength(def.materias.length)
      for (const n of plano.nodos) {
        // la columna es el índice temporal global del cuatrimestre
        expect(n.x).toBe(PAD + n.col * (NW + GX))
        // y las columnas van en orden: quien cursa después está más a la derecha
        expect(n.col).toBe((n.year - 1) * 2 + (n.cuatri - 1))
      }
    })

    it('ninguna tarjeta pisa a otra y todas entran en el lienzo', () => {
      const lugares = new Set<string>()
      for (const n of plano.nodos) {
        const lugar = `${n.x},${n.y}`
        expect(lugares.has(lugar)).toBe(false)
        lugares.add(lugar)
        expect(n.x + NW).toBeLessThanOrEqual(plano.w)
        expect(n.y + NH).toBeLessThanOrEqual(plano.h)
        expect(n.y).toBeGreaterThanOrEqual(TOP - 1)
      }
    })

    it('cada columna queda centrada contra la más alta', () => {
      const porCol = new Map<number, number[]>()
      for (const n of plano.nodos) {
        const ys = porCol.get(n.col) ?? []
        ys.push(n.y)
        porCol.set(n.col, ys)
      }
      const maxFilas = Math.max(...[...porCol.values()].map((ys) => ys.length))
      const alto = maxFilas * (NH + GY) - GY
      for (const ys of porCol.values()) {
        ys.sort((a, b) => a - b)
        // filas consecutivas a paso exacto…
        for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBe(NH + GY)
        // …y el hueco de arriba igual al de abajo (±1 por el redondeo)
        const arriba = ys[0] - TOP
        const abajo = TOP + alto - (ys[ys.length - 1] + NH)
        expect(Math.abs(arriba - abajo)).toBeLessThanOrEqual(1)
      }
    })

    it('toda arista dibujada va hacia la derecha (a un cuatrimestre posterior)', () => {
      for (const a of plano.aristas) {
        const de = plano.porCod.get(a.de)!
        const hasta = plano.porCod.get(a.a)!
        expect(de.col).toBeLessThan(hasta.col)
      }
    })

    it('la reducción transitiva conserva el alcance de cada materia', () => {
      // la cadena leída sobre las aristas dibujadas tiene que ser LA MISMA que la
      // del grafo completo: sacar flechas deducibles no puede perder dependencias
      const sig = new Map<string, string[]>()
      for (const a of plano.aristas) (sig.get(a.de) ?? sig.set(a.de, []).get(a.de)!).push(a.a)
      const alcanceDibujado = (cod: string): Set<string> => {
        const out = new Set<string>()
        const pila = [...(sig.get(cod) ?? [])]
        while (pila.length) {
          const w = pila.pop()!
          if (out.has(w)) continue
          out.add(w)
          for (const x of sig.get(w) ?? []) pila.push(x)
        }
        return out
      }
      for (const m of def.materias) {
        expect(alcanceDibujado(m.cod)).toEqual(plan.chainDown(m.cod))
      }
    })

    it('no queda ninguna arista redundante (deducible por otro camino)', () => {
      const como: ParCorrelativa[] = plano.aristas.map((a) => ({ cod: a.a, requiere: a.de }))
      expect(reducirTransitivamente(como)).toHaveLength(como.length)
    })

    it('las bandas cubren los años en orden y arrancan donde arranca su columna', () => {
      expect(plano.bandas.map((b) => b.year)).toEqual(plan.anios.map((a) => a.year))
      for (const b of plano.bandas) {
        const cols = plano.nodos.filter((n) => n.year === b.year)
        const x0 = Math.min(...cols.map((n) => n.x))
        const x1 = Math.max(...cols.map((n) => n.x + NW))
        expect(b.x).toBe(x0 - 26)
        expect(b.x + b.w).toBe(x1 + 26)
      }
    })
  })
}

describe('reducirTransitivamente', () => {
  it('saca la flecha que ya se deduce por el camino largo', () => {
    // a → b → c y además a → c directa: la directa sobra
    const cs: ParCorrelativa[] = [
      { cod: 'b', requiere: 'a' },
      { cod: 'c', requiere: 'b' },
      { cod: 'c', requiere: 'a' },
    ]
    expect(reducirTransitivamente(cs)).toEqual([
      { cod: 'b', requiere: 'a' },
      { cod: 'c', requiere: 'b' },
    ])
  })

  it('no toca un grafo sin redundancia', () => {
    const cs: ParCorrelativa[] = [
      { cod: 'b', requiere: 'a' },
      { cod: 'c', requiere: 'a' },
    ]
    expect(reducirTransitivamente(cs)).toEqual(cs)
  })
})
