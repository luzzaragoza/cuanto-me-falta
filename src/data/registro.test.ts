import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PlanDef, Universidad } from './model'
import {
  borrarCache,
  filaAPlan,
  guardarCache,
  igualRegistro,
  leerCache,
  registroInicial,
  sanear,
  type Registro,
} from './registro'

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

const UNI: Universidad[] = [{ id: 'uade', nombre: 'UADE' }]

function plan(over: Partial<PlanDef> = {}): PlanDef {
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

const bundle = (): Registro => ({ universidades: UNI, planes: [plan()] })

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
    expect(registroInicial(bundle()).planes).toHaveLength(1)
    expect(registroInicial(bundle()).planes[0].id).toBe('p1')
  })

  it('con caché válido, el caché gana', () => {
    guardarCache({ universidades: UNI, planes: [plan({ id: 'nuevo', carrera: 'Del backend' })] })
    const reg = registroInicial(bundle())
    expect(reg.planes.map((p) => p.id)).toEqual(['nuevo'])
  })

  it('el caché puede traer MÁS planes que el bundle', () => {
    guardarCache({ universidades: UNI, planes: [plan(), plan({ id: 'p2' })] })
    expect(registroInicial(bundle()).planes).toHaveLength(2)
  })

  it('descarta del caché los planes que no pasan el validador', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const roto = plan({ id: 'roto', correlativas: [{ cod: 'A', requiere: 'NO_EXISTE' }] })
    guardarCache({ universidades: UNI, planes: [plan({ id: 'sano' }), roto] })
    expect(registroInicial(bundle()).planes.map((p) => p.id)).toEqual(['sano'])
    warn.mockRestore()
  })

  it('si el caché queda sin planes válidos, cae al bundle', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    guardarCache({ universidades: UNI, planes: [plan({ materias: [], correlativas: [] })] })
    expect(registroInicial(bundle()).planes[0].id).toBe('p1')
    warn.mockRestore()
  })

  it('ignora un caché de versión vieja', () => {
    localStorage.setItem(
      'cmf-planes-cache',
      JSON.stringify({ v: 0, at: 'x', universidades: UNI, planes: [plan({ id: 'viejo' })] }),
    )
    expect(registroInicial(bundle()).planes[0].id).toBe('p1')
  })

  it('ignora un caché ilegible', () => {
    localStorage.setItem('cmf-planes-cache', 'no soy json {{{')
    expect(leerCache()).toBeNull()
    expect(registroInicial(bundle()).planes[0].id).toBe('p1')
  })

  it('si el caché no trae universidades, usa los nombres del bundle', () => {
    guardarCache({ universidades: [], planes: [plan({ id: 'x' })] })
    const reg = registroInicial(bundle())
    expect(reg.planes[0].id).toBe('x')
    expect(reg.universidades).toEqual(UNI)
  })

  it('borrarCache vuelve al bundle', () => {
    guardarCache({ universidades: UNI, planes: [plan({ id: 'x' })] })
    borrarCache()
    expect(leerCache()).toBeNull()
  })

  it('sin localStorage (SSR, tests, modo privado) no explota y usa el bundle', () => {
    Reflect.deleteProperty(globalThis, 'localStorage')
    expect(() => guardarCache(bundle())).not.toThrow()
    expect(leerCache()).toBeNull()
    expect(registroInicial(bundle()).planes[0].id).toBe('p1')
  })
})

describe('registro · sanear', () => {
  it('deja pasar lo válido y filtra universidades incompletas', () => {
    const reg = sanear({
      universidades: [{ id: 'uade', nombre: 'UADE' }, { id: '', nombre: 'Sin id' }],
      planes: [plan()],
    })
    expect(reg.universidades).toHaveLength(1)
    expect(reg.planes).toHaveLength(1)
  })
})

describe('registro · comparación estable', () => {
  it('el orden de las CLAVES no cuenta (bundle TS vs JSON del backend)', () => {
    const a: Registro = { universidades: UNI, planes: [plan()] }
    // mismo plan, claves en otro orden (como lo escribiría otro archivo)
    const p = plan()
    const b: Registro = {
      planes: [
        {
          titulos: p.titulos,
          carrera: p.carrera,
          materias: p.materias,
          id: p.id,
          anio: p.anio,
          codigo: p.codigo,
          correlativas: p.correlativas,
          universidad: p.universidad,
        },
      ],
      universidades: UNI,
    }
    expect(igualRegistro(a, b)).toBe(true)
  })

  it('el orden de los ARRAYS sí cuenta (así se dibuja el plan)', () => {
    const a: Registro = { universidades: UNI, planes: [plan()] }
    const b: Registro = {
      universidades: UNI,
      planes: [plan({ materias: [...plan().materias].reverse() })],
    }
    expect(igualRegistro(a, b)).toBe(false)
  })

  it('un cambio real se detecta', () => {
    const b: Registro = { universidades: UNI, planes: [plan({ carrera: 'Otra cosa' })] }
    expect(igualRegistro(bundle(), b)).toBe(false)
  })
})

describe('registro · filaAPlan (dato que llega de la red)', () => {
  it('convierte una fila bien formada', () => {
    const p = filaAPlan(fila())
    expect(p).not.toBeNull()
    expect(p!.id).toBe('p2')
    expect(p!.materias).toHaveLength(2)
    expect(p!.correlativas).toEqual([{ cod: 'Y', requiere: 'X' }])
    expect(p!.titulos).toEqual([{ nombre: 'Título Dos', hastaAnio: 1 }])
  })

  it('no inventa claves: opt y especial solo viajan cuando son true', () => {
    const p = filaAPlan(
      fila({
        materias: [
          { cod: 'X', nom: 'Equis', anio: 1, cuatri: 1, opt: false, especial: false },
          { cod: 'Y', nom: 'Ye', anio: 1, cuatri: 2, opt: true, especial: true },
        ],
      }),
    )
    expect(p!.materias[0]).toEqual({ cod: 'X', nom: 'Equis', anio: 1, cuatri: 1 })
    expect(p!.materias[1]).toEqual({
      cod: 'Y',
      nom: 'Ye',
      anio: 1,
      cuatri: 2,
      opt: true,
      especial: true,
    })
  })

  it('conserva hastaCuatri cuando el título cae a mitad de año', () => {
    const p = filaAPlan(fila({ titulos: [{ nombre: 'T', hastaAnio: 1, hastaCuatri: 1 }] }))
    expect(p!.titulos[0]).toEqual({ nombre: 'T', hastaAnio: 1, hastaCuatri: 1 })
  })

  it('rechaza filas incompletas o con tipos raros', () => {
    expect(filaAPlan(null)).toBeNull()
    expect(filaAPlan('un string')).toBeNull()
    expect(filaAPlan(fila({ carrera: '' }))).toBeNull()
    expect(filaAPlan(fila({ anio: '2026' }))).toBeNull()
    expect(filaAPlan(fila({ materias: 'nope' }))).toBeNull()
    expect(filaAPlan(fila({ materias: [{ cod: 'X', nom: 'X', anio: '1', cuatri: 1 }] }))).toBeNull()
    expect(filaAPlan(fila({ correlativas: [{ cod: 'Y' }] }))).toBeNull()
    expect(filaAPlan(fila({ titulos: [{ nombre: 'T' }] }))).toBeNull()
  })

  it('un plan del backend que no valida se descarta al sanear', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = filaAPlan(fila({ correlativas: [{ cod: 'X', requiere: 'Y' }] })) // al revés en el tiempo
    expect(p).not.toBeNull()
    expect(sanear({ universidades: UNI, planes: [p!] }).planes).toEqual([])
    warn.mockRestore()
  })
})
