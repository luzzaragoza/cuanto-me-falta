import type { DB, Estado, Perfil } from '../types'

const ESTADOS: Estado[] = ['pendiente', 'cursando', 'final', 'aprobada']

/** DB vacía por defecto. */
function emptyDB(): DB {
  return { states: {}, notas: {}, optNames: {}, custom: [] }
}

/**
 * Estado del usuario + persistencia en el navegador.
 *
 * Es un store observable: las vistas se suscriben con `subscribe` y React lo
 * consume vía `useSyncExternalStore`. Cada mutación crea una nueva referencia
 * de `db` (inmutable) para que React detecte el cambio, persiste y notifica.
 *
 * Reusa la clave `plan-uade-v3` de la versión anterior, así los datos ya
 * guardados en el navegador se mantienen al migrar.
 */
export class Store {
  private db: DB
  private readonly listeners = new Set<() => void>()
  private readonly key: string

  constructor(key = 'plan-uade-v3') {
    this.key = key
    this.db = this.load()
  }

  // ---- lectura ----
  estado(cod: string): Estado {
    return this.db.states[cod] ?? 'pendiente'
  }
  nota(cod: string): number | undefined {
    return this.db.notas[cod]
  }
  optName(cod: string): string | undefined {
    return this.db.optNames[cod]
  }

  // ---- suscripción (para React) ----
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  getSnapshot = (): DB => this.db

  // ---- mutaciones ----
  setEstado(cod: string, estado: Estado): void {
    this.db = { ...this.db, states: { ...this.db.states, [cod]: estado } }
    this.commit()
  }

  /** Cicla pendiente → cursando → final → aprobada → pendiente (provisorio hasta el popover). */
  ciclarEstado(cod: string): void {
    const i = ESTADOS.indexOf(this.estado(cod))
    this.setEstado(cod, ESTADOS[(i + 1) % ESTADOS.length])
  }

  setNota(cod: string, valor: number | null): void {
    const notas = { ...this.db.notas }
    if (valor == null || Number.isNaN(valor)) delete notas[cod]
    else notas[cod] = Math.max(1, Math.min(10, Math.round(valor)))
    this.db = { ...this.db, notas }
    this.commit()
  }

  setOptName(cod: string, nombre: string): void {
    const optNames = { ...this.db.optNames }
    const v = nombre.trim()
    if (v === '') delete optNames[cod]
    else optNames[cod] = v.slice(0, 48)
    this.db = { ...this.db, optNames }
    this.commit()
  }

  setPerfil(perfil: Perfil): void {
    this.db = { ...this.db, profile: perfil }
    this.commit()
  }

  reset(): void {
    this.db = { ...emptyDB(), profile: this.db.profile }
    this.commit()
  }

  // ---- backup ----
  exportar(): string {
    return JSON.stringify(
      { app: 'plan-uade', version: 3, exportedAt: new Date().toISOString(), ...this.db },
      null,
      2,
    )
  }
  importar(json: string): boolean {
    try {
      const d = JSON.parse(json)
      if (!d || typeof d !== 'object' || !('states' in d)) return false
      this.db = {
        states: d.states ?? {},
        notas: d.notas ?? {},
        optNames: d.optNames ?? {},
        custom: d.custom ?? [],
        profile: d.profile ?? this.db.profile,
      }
      this.commit()
      return true
    } catch {
      return false
    }
  }

  // ---- internos ----
  private commit(): void {
    this.persist()
    this.listeners.forEach((l) => l())
  }
  private persist(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.db))
    } catch (e) {
      console.error('No pude guardar en localStorage', e)
    }
  }
  private load(): DB {
    try {
      const raw = localStorage.getItem(this.key)
      if (raw) {
        const d = JSON.parse(raw)
        return {
          states: d.states ?? {},
          notas: d.notas ?? {},
          optNames: d.optNames ?? {},
          custom: d.custom ?? [],
          profile: d.profile,
        }
      }
    } catch (e) {
      console.error('No pude leer localStorage', e)
    }
    return emptyDB()
  }
}
