import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PlanDef, Universidad } from './model'
import type { PlanJSON } from './json'
import { Registro } from './registro'

// localStorage de mentira, en memoria (mismo helper que Store.test / sync.test).
function fakeLocalStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

const UNI: Universidad[] = [new Universidad('uade', 'UADE')]

function planJSON(over: Partial<PlanJSON> = {}): PlanJSON {
  return {
    id: 'p1',
    universidad: 'uade',
    codigo: '1000',
    anio: 2026,
    carrera: 'Carrera Uno',
    materias: [
      { cod: 'A', nom: 'A', anio: 1, cuatri: 1 },
      { cod: 'B', nom: 'B', anio: 1, cuatri: 2 },
    ],
    correlativas: [{ cod: 'B', requiere: 'A' }],
    titulos: [{ nombre: 'Título Uno', hastaAnio: 1 }],
    ...over,
  }
}

const plan = (over: Partial<PlanJSON> = {}): PlanDef => PlanDef.exigir(planJSON(over))

const bundle = (): Registro => new Registro(UNI, [plan()])

/** Fila tal como la devuelve la vista `plan_publicado`. */
function fila(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p2',
    universidad: 'uade',
    codigo: '2000',
    anio: 2025,
    carrera: 'Carrera Dos',
    materias: [
      { cod: 'X', nom: 'Equis', anio: 1, cuatri: 1 },
      { cod: 'Y', nom: 'Ye', anio: 1, cuatri: 2 },
    ],
    correlativas: [{ cod: 'Y', requiere: 'X' }],
    titulos: [{ nombre: 'Título Dos', hastaAnio: 1 }],
    ...over,
  }
}

beforeEach(() => {
  globalThis.localStorage = fakeLocalStorage()
})

describe('registro · de dónde salen los planes al arrancar', () => {
  it('sin caché usa el bundle', () => {
    expect(Registro.inicial(bundle()).planes).toHaveLength(1)
    expect(Registro.inicial(bundle()).planes[0].id).toBe('p1')
  })

  it('con caché válido, el caché gana', () => {
    new Registro(UNI, [plan({ id: 'nuevo', carrera: 'Del backend' })]).guardarEnCache()
    const reg = Registro.inicial(bundle())
    expect(reg.planes.map((p) => p.id)).toEqual(['nuevo'])
  })

  it('el caché puede traer MÁS planes que el bundle', () => {
    new Registro(UNI, [plan(), plan({ id: 'p2' })]).guardarEnCache()
    expect(Registro.inicial(bundle()).planes).toHaveLength(2)
  })

  it('descarta del caché los planes que no pasan el validador', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const roto = plan({ id: 'roto', correlativas: [{ cod: 'A', requiere: 'NO_EXISTE' }] })
    new Registro(UNI, [plan({ id: 'sano' }), roto]).guardarEnCache()
    expect(Registro.inicial(bundle()).planes.map((p) => p.id)).toEqual(['sano'])
    warn.mockRestore()
  })

  it('si el caché queda sin planes válidos, cae al bundle', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    new Registro(UNI, [plan({ materias: [], correlativas: [] })]).guardarEnCache()
    expect(Registro.inicial(bundle()).planes[0].id).toBe('p1')
    warn.mockRestore()
  })

  it('ignora un caché de versión vieja', () => {
    localStorage.setItem(
      'cmf-planes-cache',
      JSON.stringify({ v: 0, at: 'x', universidades: UNI, planes: [plan({ id: 'viejo' })] }),
    )
    expect(Registro.inicial(bundle()).planes[0].id).toBe('p1')
  })

  it('ignora un caché ilegible', () => {
    localStorage.setItem('cmf-planes-cache', 'no soy json {{{')
    expect(Registro.leerCache()).toBeNull()
    expect(Registro.inicial(bundle()).planes[0].id).toBe('p1')
  })

  it('si el caché no trae universidades, usa los nombres del bundle', () => {
    new Registro([], [plan({ id: 'x' })]).guardarEnCache()
    const reg = Registro.inicial(bundle())
    expect(reg.planes[0].id).toBe('x')
    expect(reg.universidades).toEqual(UNI)
  })

  it('borrarCache vuelve al bundle', () => {
    new Registro(UNI, [plan({ id: 'x' })]).guardarEnCache()
    Registro.borrarCache()
    expect(Registro.leerCache()).toBeNull()
  })

  it('sin localStorage (SSR, tests, modo privado) no explota y usa el bundle', () => {
    Reflect.deleteProperty(globalThis, 'localStorage')
    expect(() => bundle().guardarEnCache()).not.toThrow()
    expect(Registro.leerCache()).toBeNull()
    expect(Registro.inicial(bundle()).planes[0].id).toBe('p1')
  })
})

describe('registro · sanear', () => {
  it('deja pasar lo válido y filtra universidades incompletas', () => {
    const reg = new Registro([new Universidad('uade', 'UADE'), new Universidad('', 'Sin id')], [plan()]).saneado()
    expect(reg.universidades).toHaveLength(1)
    expect(reg.planes).toHaveLength(1)
  })
})

describe('registro · comparación estable', () => {
  it('el orden de las CLAVES no cuenta (bundle TS vs JSON del backend)', () => {
    const a: Registro = new Registro(UNI, [plan()])
    // mismo plan, claves en otro orden (como lo escribiría otro archivo)
    const j = planJSON()
    const b: Registro = new Registro(UNI, [
      PlanDef.exigir({
          titulos: j.titulos,
          carrera: j.carrera,
          materias: j.materias,
          id: j.id,
          anio: j.anio,
          codigo: j.codigo,
          correlativas: j.correlativas,
        universidad: j.universidad,
      }),
    ])
    expect(a.igualA(b)).toBe(true)
  })

  it('el orden de los ARRAYS sí cuenta (así se dibuja el plan)', () => {
    const a: Registro = new Registro(UNI, [plan()])
    const b: Registro = new Registro(UNI, [plan({ materias: [...planJSON().materias].reverse() })])
    expect(a.igualA(b)).toBe(false)
  })

  it('un cambio real se detecta', () => {
    const b: Registro = new Registro(UNI, [plan({ carrera: 'Otra cosa' })])
    expect(bundle().igualA(b)).toBe(false)
  })
})

describe('registro · PlanDef.desde (dato que llega de la red)', () => {
  it('convierte una fila bien formada', () => {
    const p = PlanDef.desde(fila())
    expect(p).not.toBeNull()
    expect(p!.id).toBe('p2')
    expect(p!.materias).toHaveLength(2)
    expect(p!.correlativas.map((c) => c.aJSON())).toEqual([{ cod: 'Y', requiere: 'X' }])
    expect(p!.titulos.map((t) => t.aJSON())).toEqual([{ nombre: 'Título Dos', hastaAnio: 1 }])
  })

  it('no inventa claves: opt y especial solo viajan cuando son true', () => {
    const p = PlanDef.desde(
      fila({
        materias: [
          { cod: 'X', nom: 'Equis', anio: 1, cuatri: 1, opt: false, especial: false },
          { cod: 'Y', nom: 'Ye', anio: 1, cuatri: 2, opt: true, especial: true },
        ],
      }),
    )
    expect(p!.materias[0].aJSON()).toEqual({ cod: 'X', nom: 'Equis', anio: 1, cuatri: 1 })
    expect(p!.materias[1].aJSON()).toEqual({
      cod: 'Y',
      nom: 'Ye',
      anio: 1,
      cuatri: 2,
      opt: true,
      especial: true,
    })
  })

  it('conserva hastaCuatri cuando el título cae a mitad de año', () => {
    const p = PlanDef.desde(fila({ titulos: [{ nombre: 'T', hastaAnio: 1, hastaCuatri: 1 }] }))
    expect(p!.titulos[0].aJSON()).toEqual({ nombre: 'T', hastaAnio: 1, hastaCuatri: 1 })
  })

  it('rechaza filas incompletas o con tipos raros', () => {
    expect(PlanDef.desde(null)).toBeNull()
    expect(PlanDef.desde('un string')).toBeNull()
    expect(PlanDef.desde(fila({ anio: '2026' }))).toBeNull()
    expect(PlanDef.desde(fila({ materias: 'nope' }))).toBeNull()
    expect(PlanDef.desde(fila({ materias: [{ cod: 'X', nom: 'X', anio: '1', cuatri: 1 }] }))).toBeNull()
    expect(PlanDef.desde(fila({ correlativas: [{ cod: 'Y' }] }))).toBeNull()
    expect(PlanDef.desde(fila({ titulos: [{ nombre: 'T' }] }))).toBeNull()
  })

  // Contrato que CAMBIÓ a propósito con el modelo en clases. Antes `filaAPlan` rechazaba
  // una carrera vacía en el parseo; ahora la factory solo mira la FORMA ("es un string")
  // y el vacío es una REGLA que reporta el validador. El plan malo no llega a la pantalla
  // igual: lo descarta `sanear()`. Sin esta separación, un plan con una materia sin
  // nombre no se podría ni construir, y el validador nunca podría explicar qué tiene mal.
  it('una carrera vacía ya no la rechaza la factory: la agarra el validador', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = PlanDef.desde(fila({ carrera: '' }))
    expect(p).not.toBeNull()
    expect(new Registro(UNI, [p!]).saneado().planes).toEqual([])
    warn.mockRestore()
  })

  it('un plan del backend que no valida se descarta al sanear', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = PlanDef.desde(fila({ correlativas: [{ cod: 'X', requiere: 'Y' }] })) // al revés en el tiempo
    expect(p).not.toBeNull()
    expect(new Registro(UNI, [p!]).saneado().planes).toEqual([])
    warn.mockRestore()
  })
})
