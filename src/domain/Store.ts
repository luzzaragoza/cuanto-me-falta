import { DB, Espejo, type Estado, type Perfil } from '../types'

/**
 * El estado del usuario, vivo: persistencia en el navegador y aviso a quien mire.
 *
 * Es un store observable: las vistas se suscriben con `subscribe` y React lo consume
 * vía `useSyncExternalStore`. Cada mutación reemplaza la `DB` por una nueva (por eso
 * `DB` es inmutable), persiste y notifica.
 *
 * Repartija de responsabilidades: **la `DB` sabe cómo se pasa de un estado al
 * siguiente; el `Store` sabe cuándo eso se guarda y a quién hay que avisarle.** Antes
 * las dos cosas estaban acá mezcladas, y cada método repetía el spread a mano.
 *
 * Reusa la clave `plan-uade-v3` de la versión anterior, así los datos ya guardados en
 * el navegador se mantienen al migrar.
 *
 * Si recibe un `espejo` (avance heredado de las otras carreras, ver `lib/espejo.ts`),
 * lo que ve la UI lo lleva DEBAJO de las marcas propias. El espejo NUNCA se persiste ni
 * se exporta — es una vista, no datos de este plan.
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
    this.vista = this.db.bajo(this.espejo)
  }

  // ---- lectura (sobre la vista: marcas propias + espejo debajo) ----
  estado(cod: string): Estado {
    return this.vista.estado(cod)
  }
  nota(cod: string): number | undefined {
    return this.vista.nota(cod)
  }
  optName(cod: string): string | undefined {
    return this.vista.optName(cod)
  }

  // ---- suscripción (para React) ----
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  getSnapshot = (): DB => this.vista

  // ---- mutaciones ----
  setEstado(cod: string, estado: Estado): void {
    this.commit(this.db.conEstado(cod, estado))
  }

  /**
   * Marca varias materias de una (un solo commit → una sola escritura y un solo push al
   * sync). Es lo que usa el interruptor de año. Devuelve el cambio INVERSO, que es lo
   * que el "deshacer" necesita para dejar todo exactamente como estaba.
   */
  setEstados(cambios: Record<string, Estado | undefined>): Record<string, Estado | undefined> {
    const { db, inverso } = this.db.conEstados(cambios)
    if (db !== this.db) this.commit(db)
    return inverso
  }

  setNota(cod: string, valor: number | null): void {
    this.commit(this.db.conNota(cod, valor))
  }

  setOptName(cod: string, nombre: string): void {
    this.commit(this.db.conOptName(cod, nombre))
  }

  setPerfil(perfil: Perfil): void {
    this.commit(this.db.conPerfil(perfil))
  }

  reset(): void {
    this.commit(this.db.sinProgreso())
  }

  // ---- backup ----
  exportar(): string {
    return JSON.stringify(
      { app: 'plan-uade', version: 3, exportedAt: new Date().toISOString(), ...this.db.aJSON() },
      null,
      2,
    )
  }

  importar(json: string): boolean {
    try {
      const d: unknown = JSON.parse(json)
      if (typeof d !== 'object' || d === null || !('states' in d)) return false
      const leida = DB.desde(d)
      // si el archivo no trae perfil, se conserva el de este dispositivo
      const perfil = leida.profile ?? this.db.profile
      this.commit(perfil ? leida.conPerfil(perfil) : leida)
      return true
    } catch {
      return false
    }
  }

  // ---- internos ----
  /** Adopta la DB nueva: recalcula la vista, persiste y avisa. Punto único de cambio. */
  private commit(db: DB): void {
    this.db = db
    this.vista = db.bajo(this.espejo)
    this.persist()
    this.listeners.forEach((l) => l())
  }

  private persist(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.db.aJSON()))
    } catch (e) {
      console.error('No pude guardar en localStorage', e)
    }
  }

  private load(): DB {
    try {
      const raw = localStorage.getItem(this.key)
      if (raw) return DB.desde(JSON.parse(raw))
    } catch (e) {
      console.error('No pude leer localStorage', e)
    }
    return DB.vacia()
  }
}
