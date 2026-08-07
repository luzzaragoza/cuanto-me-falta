import { describe, it, expect } from 'vitest'
import { PLANES } from '../data/planes'
import {
  cadenaDe,
  invariantes,
  layoutGrafo,
  layoutMalla,
  subgrafoRama,
  reduccionTransitiva,
  DIST_CORTA,
  NODEX,
  PADX,
  type GrafoPlan,
} from './arbolLayout'

// Los invariantes geométricos del árbol, verificados contra el layout REAL de
// cada plan (y de cada rama). Esto es lo que convierte "el árbol quedó mal" en
// un build rojo — incluso para planes futuros: agregar una carrera es agregar
// datos, y estos tests la validan sola. (ELK corre en node: no hace falta DOM.)

const CERO = { cruces: 0, pegados: 0, haciaArriba: 0, filasDesordenadas: 0 }

const grafoDe = (p: (typeof PLANES)[number]): GrafoPlan => ({
  materias: p.materias,
  correlativas: p.correlativas,
})

for (const plan of PLANES) {
  describe(`arbolLayout · ${plan.carrera}`, () => {
    it('la malla es una grilla exacta y limpia (invariantes en cero)', async () => {
      const lay = await layoutMalla(grafoDe(plan))
      expect(Object.keys(lay.pos)).toHaveLength(plan.materias.length)
      // columnas perfectamente alineadas (slots enteros) y sin dos materias en el mismo lugar
      const lugares = new Set<string>()
      for (const p of Object.values(lay.pos)) {
        expect((p.x - PADX) % NODEX).toBe(0)
        const lugar = `${p.x},${p.y}`
        expect(lugares.has(lugar)).toBe(false)
        lugares.add(lugar)
      }
      // ninguna flecha cruza una tarjeta ajena, ninguna va para arriba, filas en orden
      expect(invariantes(lay)).toEqual(CERO)
    })

    it('en reposo dibuja las correlativas cortas no redundantes, y SOLO esas', async () => {
      const lay = await layoutMalla(grafoDe(plan))
      const q = new Map(plan.materias.map((m) => [m.cod, (m.anio - 1) * 2 + (m.cuatri - 1)]))
      const salto = (id: string) => {
        const [src, tgt] = id.split('->')
        return q.get(tgt)! - q.get(src)!
      }
      const dibujadas = Object.keys(lay.aristas)
      // toda flecha de la malla salta 1 o 2 cuatrimestres: las largas son las que
      // armaban la trenza y se ven solo en modo rama
      for (const id of dibujadas) {
        expect(salto(id), id).toBeGreaterThanOrEqual(1)
        expect(salto(id), id).toBeLessThanOrEqual(DIST_CORTA)
      }
      // y no se pierde ninguna que sí corresponda (el ruteo encuentra paso para todas)
      const esperadas = reduccionTransitiva(plan.correlativas).filter((c) => {
        const d = q.get(c.cod)! - q.get(c.requiere)!
        return d >= 1 && d <= DIST_CORTA
      })
      expect(new Set(dibujadas)).toEqual(new Set(esperadas.map((c) => `${c.requiere}->${c.cod}`)))
      // el esqueleto que se ve de entrada es la mayoría del grafo
      expect(esperadas.length / plan.correlativas.length).toBeGreaterThan(0.5)
    })

    it('la reducción transitiva no cambia lo que se alcanza desde cada materia', () => {
      const reducidas = reduccionTransitiva(plan.correlativas)
      const alcanzables = (cs: typeof plan.correlativas, desde: string) => {
        const sig = new Map<string, string[]>()
        for (const c of cs) (sig.get(c.requiere) ?? sig.set(c.requiere, []).get(c.requiere)!).push(c.cod)
        const vistos = new Set<string>()
        const pila = [...(sig.get(desde) ?? [])]
        while (pila.length) {
          const w = pila.pop()!
          if (vistos.has(w)) continue
          vistos.add(w)
          for (const x of sig.get(w) ?? []) pila.push(x)
        }
        return vistos
      }
      // sacamos flechas deducibles, no información: la cadena completa es la misma
      for (const m of plan.materias)
        expect(alcanzables(reducidas, m.cod), m.cod).toEqual(alcanzables(plan.correlativas, m.cod))
      expect(reducidas.length).toBeLessThanOrEqual(plan.correlativas.length)
    })

    it('ninguna rama tiene una flecha que salte del "necesitás" al "habilita"', () => {
      // Es lo que hacía que un tronco compartido (ELK fusiona las flechas que
      // salen de la misma materia) quedara pintado de dos colores distintos.
      // Después de la reducción transitiva es imposible: ese salto siempre pasa
      // por el foco. Se verifica para CADA materia con cadena.
      const grafo = grafoDe(plan)
      for (const m of plan.materias) {
        const { up, down } = cadenaDe(plan.correlativas, m.cod)
        if (up.size === 0 || down.size === 0) continue
        for (const c of subgrafoRama(grafo, m.cod).correlativas)
          expect(
            up.has(c.requiere) && down.has(c.cod),
            `${c.requiere}->${c.cod} en la rama de ${m.cod}`,
          ).toBe(false)
      }
    })

    it('la rama de CADA materia con cadena cumple los invariantes (modo rama)', async () => {
      const grafo = grafoDe(plan)
      const conCadena = plan.materias.filter((m) =>
        plan.correlativas.some((c) => c.cod === m.cod || c.requiere === m.cod),
      )
      expect(conCadena.length).toBeGreaterThan(0)
      for (const m of conCadena) {
        const sub = subgrafoRama(grafo, m.cod)
        const lay = await layoutGrafo(sub)
        expect(invariantes(lay), `rama de ${m.cod} ${m.nom}`).toEqual(CERO)
      }
    }, 30000)

    it('el subgrafo de la rama es exactamente la cadena (up + down + foco)', () => {
      const m = plan.correlativas[0]
      const sub = subgrafoRama(grafoDe(plan), m.cod)
      const { up, down } = cadenaDe(plan.correlativas, m.cod)
      expect(new Set(sub.materias.map((x) => x.cod))).toEqual(new Set([m.cod, ...up, ...down]))
      // ninguna correlativa del subgrafo apunta afuera
      const cods = new Set(sub.materias.map((x) => x.cod))
      for (const c of sub.correlativas) {
        expect(cods.has(c.cod)).toBe(true)
        expect(cods.has(c.requiere)).toBe(true)
      }
    })
  })
}
