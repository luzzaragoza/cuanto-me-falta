import { describe, it, expect, beforeEach } from 'vitest'
import { Store } from './Store'

// localStorage de mentira, en memoria: deja probar la persistencia sin navegador.
// El Store lee `localStorage` del scope global, así que lo inyectamos ahí.
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

beforeEach(() => {
  globalThis.localStorage = fakeLocalStorage()
})

describe('Store · estados y notas', () => {
  it('arranca con todo en pendiente', () => {
    const s = new Store('k')
    expect(s.estado('X')).toBe('pendiente')
    expect(s.nota('X')).toBeUndefined()
  })

  it('setEstado guarda y lee el estado', () => {
    const s = new Store('k')
    s.setEstado('X', 'cursando')
    expect(s.estado('X')).toBe('cursando')
  })

  it('setNota acota la nota al rango 1–10 y redondea', () => {
    const s = new Store('k')
    s.setNota('X', 7.6)
    expect(s.nota('X')).toBe(8)
    s.setNota('X', 12)
    expect(s.nota('X')).toBe(10)
    s.setNota('X', 0)
    expect(s.nota('X')).toBe(1)
  })

  it('setNota con null o NaN borra la nota', () => {
    const s = new Store('k')
    s.setNota('X', 9)
    s.setNota('X', null)
    expect(s.nota('X')).toBeUndefined()
  })

  it('setOptName recorta espacios y borra si queda vacío', () => {
    const s = new Store('k')
    s.setOptName('OPT1', '  Machine Learning  ')
    expect(s.optName('OPT1')).toBe('Machine Learning')
    s.setOptName('OPT1', '   ')
    expect(s.optName('OPT1')).toBeUndefined()
  })
})

describe('Store · reset e inmutabilidad', () => {
  it('reset limpia estados y notas pero conserva el perfil', () => {
    const s = new Store('k')
    s.setPerfil({ name: 'Luz', photo: '' })
    s.setEstado('X', 'aprobada')
    s.setNota('X', 9)
    s.reset()
    expect(s.estado('X')).toBe('pendiente')
    expect(s.nota('X')).toBeUndefined()
    expect(s.getSnapshot().profile).toEqual({ name: 'Luz', photo: '' })
  })

  it('cada mutación crea una nueva referencia de db (para React)', () => {
    const s = new Store('k')
    const antes = s.getSnapshot()
    s.setEstado('X', 'cursando')
    expect(s.getSnapshot()).not.toBe(antes)
  })
})

describe('Store · persistencia', () => {
  it('los datos sobreviven al recrear el Store con la misma clave', () => {
    const s1 = new Store('mi-clave')
    s1.setEstado('X', 'aprobada')
    s1.setNota('X', 8)
    const s2 = new Store('mi-clave')
    expect(s2.estado('X')).toBe('aprobada')
    expect(s2.nota('X')).toBe(8)
  })

  it('claves distintas no comparten datos', () => {
    const s1 = new Store('clave-a')
    s1.setEstado('X', 'aprobada')
    const s2 = new Store('clave-b')
    expect(s2.estado('X')).toBe('pendiente')
  })
})

describe('Store · suscripción (observable)', () => {
  it('notifica a los listeners en cada mutación y deja de hacerlo al desuscribir', () => {
    const s = new Store('k')
    let llamadas = 0
    const unsub = s.subscribe(() => {
      llamadas++
    })
    s.setEstado('X', 'aprobada')
    expect(llamadas).toBe(1)
    unsub()
    s.setEstado('Y', 'aprobada')
    expect(llamadas).toBe(1)
  })
})

describe('Store · export / import', () => {
  it('exportar produce un JSON que importar entiende (round-trip)', () => {
    const s1 = new Store('k1')
    s1.setEstado('X', 'cursando')
    s1.setNota('X', 7)
    s1.setOptName('OPT1', 'Robótica')
    const json = s1.exportar()

    const s2 = new Store('k2')
    expect(s2.importar(json)).toBe(true)
    expect(s2.estado('X')).toBe('cursando')
    expect(s2.nota('X')).toBe(7)
    expect(s2.optName('OPT1')).toBe('Robótica')
  })

  it('importar rechaza JSON inválido o sin estructura esperada', () => {
    const s = new Store('k')
    expect(s.importar('esto no es json')).toBe(false)
    expect(s.importar('{}')).toBe(false)
    expect(s.importar('{"states":{}}')).toBe(true)
  })
})
