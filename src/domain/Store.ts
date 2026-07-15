import type { DB, Espejo, Estado, Perfil } from '../types'

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
 *
 * Si recibe un `espejo` (avance heredado de las otras carreras, ver
 * `lib/espejo.ts`), el snapshot que ve la UI lo pone DEBAJO de las marcas
 * propias: una materia compartida ya aprobada en otra carrera figura aprobada
 * acá, pero cualquier marca explícita de este plan gana. El espejo NUNCA se
 * persiste ni se exporta — es una vista, no datos de este plan.
 */
export class Store {
  private db: DB
  private vista: DB
  private readonly espejo?: Espejo
  private readonly listeners = new Set<() => void>()
  private readonly key: string

  constructor(key = 'plan-uade-v3', espejo?: Espejo) {
    this.key = key
    this.espejo = espejo
    this.db = this.load()
    this.vista = this.conEspejo(this.db)
  }

  // ---- lectura (sobre la vista: marcas propias + espejo debajo) ----
  estado(cod: string): Estado {
    return this.vista.states[cod] ?? 'pendiente'
  }
  nota(cod: string): number | undefined {
    return this.vista.notas[cod]
  }
  optName(cod: string): string | undefined {
    return this.vista.optNames[cod]
  }

  // ---- suscripción (para React) ----
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  getSnapshot = (): DB => this.vista

  // ---- mutaciones ----
  setEstado(cod: string, estado: Estado): void {
    this.db = { ...this.db, states: { ...this.db.states, [cod]: estado } }
    this.commit()
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
    this.vista = this.conEspejo(this.db)
    this.persist()
    this.listeners.forEach((l) => l())
  }
  /** La DB que ve la UI: el espejo de otras carreras debajo de lo propio. */
  private conEspejo(db: DB): DB {
    if (!this.espejo) return db
    return {
      ...db,
      states: { ...this.espejo.states, ...db.states },
      notas: { ...this.espejo.notas, ...db.notas },
    }
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
