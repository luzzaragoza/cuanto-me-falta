import { describe, it, expect, beforeEach } from 'vitest'
import type { DB } from '../types'
import { PLAN_POR_DEFECTO } from '../data/planes'
import { storageKey } from '../state/planActivo'
import {
  CONSENT_VERSION,
  contarMarcadas,
  decidirMerge,
  escribirLocal,
  guardarBase,
  guardarConsent,
  hayProgreso,
  huellaProgreso,
  leerBase,
  leerConsent,
  leerDirty,
  limpiarDirty,
  marcarDirty,
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

  it('las materias custom cuentan como progreso y como diferencia', () => {
    const conCustom = remote({ p: db({ custom: [{ cod: 'CUST1', nom: 'Extra', y: 1, c: 1 }] }) })
    expect(hayProgreso(conCustom)).toBe(true)
    // solo-custom local vs cuenta vacía → sube; distinto custom en ambos lados → pregunta
    expect(decidirMerge(vacio, conCustom)).toBe('push')
    expect(decidirMerge(conProgreso, conCustom)).toBe('conflicto')
  })
})

describe('sync · cambios sin subir (dirty)', () => {
  const conProgreso = remote({ p: db({ states: { A: 'aprobada' } }) })
  const vacio = remote({ p: db() })

  it('la marca va y viene por localStorage', () => {
    expect(leerDirty()).toBeNull()
    marcarDirty('user-1')
    expect(leerDirty()).toBe('user-1')
    limpiarDirty()
    expect(leerDirty()).toBeNull()
  })

  it('con cambios sin subir, un borrado local NO se resucita con pull: gana lo local', () => {
    // el caso "Reiniciar todo + F5 antes del push": local vacío pero más nuevo
    expect(decidirMerge(conProgreso, vacio, true)).toBe('push')
    expect(decidirMerge(conProgreso, vacio, false)).toBe('pull')
  })

  it('con cambios sin subir e igual progreso, flushea lo pendiente (push)', () => {
    // ej.: cambió solo el perfil y refrescó antes del debounce
    const igual = remote({ p: db({ states: { A: 'aprobada' } }) })
    expect(decidirMerge(conProgreso, igual, true)).toBe('push')
    expect(decidirMerge(conProgreso, igual, false)).toBe('nada')
  })

  it('el conflicto sigue preguntando aunque haya cambios sin subir', () => {
    const otro = remote({ p: db({ states: { A: 'cursando' } }) })
    expect(decidirMerge(conProgreso, otro, true)).toBe('conflicto')
  })
})

describe('sync · base de última sincronización (no preguntar en cada dispositivo)', () => {
  const comun = remote({ p: db({ states: { A: 'aprobada' } }) })
  const avanceNube = remote({ p: db({ states: { A: 'aprobada', B: 'cursando' } }) })
  const avanceLocal = remote({ p: db({ states: { A: 'aprobada' }, notas: { A: 9 } }) })

  it('la base va y viene por localStorage, y es por cuenta', () => {
    expect(leerBase('user-1')).toBeNull()
    guardarBase('user-1', comun)
    expect(leerBase('user-1')).toBe(huellaProgreso(comun))
    expect(leerBase('user-2')).toBeNull() // la base de otra cuenta no vale
  })

  it('solo la nube avanzó desde la última sincronización → pull, sin preguntar', () => {
    expect(decidirMerge(avanceNube, comun, false, huellaProgreso(comun))).toBe('pull')
  })

  it('solo lo local avanzó (p.ej. offline) → push, sin preguntar', () => {
    expect(decidirMerge(comun, avanceLocal, false, huellaProgreso(comun))).toBe('push')
  })

  it('avanzaron los dos a la vez → sigue preguntando (algo se puede perder)', () => {
    expect(decidirMerge(avanceNube, avanceLocal, false, huellaProgreso(comun))).toBe('conflicto')
  })

  it('sin base (1ª vez de la cuenta en este dispositivo) → pregunta, como siempre', () => {
    expect(decidirMerge(avanceNube, avanceLocal, false, null)).toBe('conflicto')
  })

  it('la huella es canónica: el orden de inserción no inventa diferencias', () => {
    const unOrden = remote({ p: db({ states: { A: 'aprobada', B: 'cursando' } }) })
    const otroOrden = remote({ p: db({ states: { B: 'cursando', A: 'aprobada' } }) })
    expect(huellaProgreso(unOrden)).toBe(huellaProgreso(otroOrden))
    expect(decidirMerge(unOrden, otroOrden)).toBe('nada')
  })

  it('un pendiente explícito o un plan presente-pero-vacío no cuentan en la huella', () => {
    const conRuido = remote({ p: db({ states: { A: 'aprobada', Z: 'pendiente' } }), q: db() })
    expect(huellaProgreso(conRuido)).toBe(huellaProgreso(comun))
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

  it('el consentimiento se guarda, entra al snapshot y viaja con escribirLocal', () => {
    expect(leerConsent()).toBeNull()
    expect(snapshotLocal().consentimiento).toBeUndefined()

    const c = guardarConsent()
    expect(c.version).toBe(CONSENT_VERSION)
    expect(leerConsent()?.version).toBe(CONSENT_VERSION)
    expect(snapshotLocal().consentimiento?.version).toBe(CONSENT_VERSION)

    // otro dispositivo: baja la data remota y adopta el consentimiento que viene en ella
    const snap = snapshotLocal()
    globalThis.localStorage = fakeLocalStorage() // "dispositivo nuevo"
    expect(leerConsent()).toBeNull()
    escribirLocal(snap)
    expect(leerConsent()?.version).toBe(CONSENT_VERSION)
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
