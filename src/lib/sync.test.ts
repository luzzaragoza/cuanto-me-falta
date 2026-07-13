import { describe, it, expect, beforeEach } from 'vitest'
import type { DB } from '../types'
import { PLAN_POR_DEFECTO } from '../data/planes'
import { storageKey } from '../state/planActivo'
import {
  contarMarcadas,
  decidirMerge,
  escribirLocal,
  hayProgreso,
  snapshotLocal,
  totalMarcadas,
  type RemoteData,
} from './sync'

// mismo localStorage en memoria que usa Store.test
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

const db = (over: Partial<DB> = {}): DB => ({
  states: {},
  notas: {},
  optNames: {},
  custom: [],
  ...over,
})

const remote = (planes: Record<string, DB>, planActivo = PLAN_POR_DEFECTO): RemoteData => ({
  version: 1,
  planActivo,
  planes,
})

describe('sync · conteos', () => {
  it('contarMarcadas suma estados no-pendientes y notas', () => {
    const d = db({
      states: { A: 'aprobada', B: 'cursando', C: 'pendiente' },
      notas: { A: 8 },
    })
    expect(contarMarcadas(d)).toBe(3) // A, B + la nota de A
  })

  it('hayProgreso ignora el perfil solo', () => {
    expect(hayProgreso(remote({ x: db({ profile: { name: 'Luz', photo: '' } }) }))).toBe(false)
    expect(hayProgreso(remote({ x: db({ states: { A: 'cursando' } }) }))).toBe(true)
    expect(hayProgreso(null)).toBe(false)
  })

  it('totalMarcadas suma sobre todos los planes', () => {
    const r = remote({
      a: db({ states: { X: 'aprobada' } }),
      b: db({ states: { Y: 'cursando', Z: 'final' } }),
    })
    expect(totalMarcadas(r)).toBe(3)
  })
})

describe('sync · decidirMerge', () => {
  const conProgreso = remote({ p: db({ states: { A: 'aprobada' } }) })
  const vacio = remote({ p: db() })

  it('cuenta vacía + local con progreso → push', () => {
    expect(decidirMerge(null, conProgreso)).toBe('push')
    expect(decidirMerge(vacio, conProgreso)).toBe('push')
  })

  it('cuenta con progreso + local vacío → pull', () => {
    expect(decidirMerge(conProgreso, vacio)).toBe('pull')
  })

  it('mismo progreso en ambos → nada', () => {
    const igual = remote({ p: db({ states: { A: 'aprobada' } }) })
    expect(decidirMerge(conProgreso, igual)).toBe('nada')
  })

  it('progreso distinto en ambos → conflicto (nunca pisar sin preguntar)', () => {
    const otro = remote({ p: db({ states: { A: 'cursando' } }) })
    expect(decidirMerge(conProgreso, otro)).toBe('conflicto')
  })

  it('el perfil no cuenta como diferencia (la foto puede ser por-dispositivo)', () => {
    const conPerfil = remote({
      p: db({ states: { A: 'aprobada' }, profile: { name: 'Luz', photo: 'x' } }),
    })
    expect(decidirMerge(conProgreso, conPerfil)).toBe('nada')
  })
})

describe('sync · snapshot y escritura local', () => {
  it('snapshotLocal levanta el progreso de todos los planes guardados', () => {
    localStorage.setItem(storageKey(PLAN_POR_DEFECTO), JSON.stringify(db({ states: { A: 'aprobada' } })))
    localStorage.setItem('plan-uade-lic-gestion-ti-v3', JSON.stringify(db({ notas: { B: 9 } })))

    const snap = snapshotLocal()
    expect(snap.planes[PLAN_POR_DEFECTO].states.A).toBe('aprobada')
    expect(snap.planes['uade-lic-gestion-ti'].notas.B).toBe(9)
    expect(snap.planActivo).toBe(PLAN_POR_DEFECTO)
  })

  it('escribirLocal persiste todos los planes y el plan activo', () => {
    const r = remote(
      { 'uade-lic-gestion-ti': db({ states: { X: 'final' } }) },
      'uade-lic-gestion-ti',
    )
    escribirLocal(r)
    const guardado = JSON.parse(localStorage.getItem('plan-uade-lic-gestion-ti-v3')!)
    expect(guardado.states.X).toBe('final')
    expect(localStorage.getItem('cmf-plan-activo')).toBe('uade-lic-gestion-ti')
  })

  it('escribirLocal conserva el perfil local si el remoto no trae uno', () => {
    localStorage.setItem(
      storageKey(PLAN_POR_DEFECTO),
      JSON.stringify(db({ profile: { name: 'Luz', photo: 'foto' } })),
    )
    escribirLocal(remote({ [PLAN_POR_DEFECTO]: db({ states: { A: 'aprobada' } }) }))
    const guardado = JSON.parse(localStorage.getItem(storageKey(PLAN_POR_DEFECTO))!)
    expect(guardado.states.A).toBe('aprobada')
    expect(guardado.profile.name).toBe('Luz') // no se perdió
  })

  it('ida y vuelta: snapshot → escribir → mismo snapshot', () => {
    localStorage.setItem(
      storageKey(PLAN_POR_DEFECTO),
      JSON.stringify(db({ states: { A: 'aprobada', B: 'cursando' }, notas: { A: 10 } })),
    )
    const snap = snapshotLocal()
    localStorage.clear()
    escribirLocal(snap)
    expect(decidirMerge(snap, snapshotLocal())).toBe('nada')
  })
})
