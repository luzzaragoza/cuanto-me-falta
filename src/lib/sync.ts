// Lógica PURA del sync (sin Supabase, sin React): el snapshot local de todas las
// carreras, y la decisión de merge al iniciar sesión. Vive separada del orquestador
// (`state/sync.ts`) para poder testearla en node con un localStorage inyectado.

import type { DB } from '../types'
import { PLANES } from '../data/planes'
import { planActivoId, storageKey } from '../state/planActivo'

/** Consentimiento a los Términos y la Política de Privacidad (Ley 25.326). */
export interface Consentimiento {
  version: string
  fecha: string // ISO
}

/** Lo que viaja a la fila `progreso` de Supabase (columna `data`, JSON). */
export interface RemoteData {
  version: 1
  planActivo: string
  /** DB completa por plan, indexada por id de plan (solo los que tienen algo). */
  planes: Record<string, DB>
  /** Registro del consentimiento (viaja con los datos: aceptás una vez por cuenta). */
  consentimiento?: Consentimiento
}

/** Versión vigente de los TyC/Privacidad. Subirla re-pide consentimiento. */
export const CONSENT_VERSION = '2026-07'
const CONSENT_KEY = 'cmf-consent'

export function leerConsent(): Consentimiento | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    return raw ? (JSON.parse(raw) as Consentimiento) : null
  } catch {
    return null
  }
}

export function guardarConsent(): Consentimiento {
  const c: Consentimiento = { version: CONSENT_VERSION, fecha: new Date().toISOString() }
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(c))
  } catch {
    /* modo incógnito, etc. */
  }
  return c
}

// ---- "hay cambios locales sin subir" ----
// Marca que sobrevive al refresh: si el usuario borra/edita y recarga ANTES de que
// el push con debounce llegue al server, el merge inicial NO debe resucitar lo
// borrado bajándolo de la cuenta — lo local es más nuevo. Guarda el user id para
// que un flag de una cuenta no le gane datos a otra en el mismo navegador.
const DIRTY_KEY = 'cmf-sync-dirty'

export function leerDirty(): string | null {
  try {
    return localStorage.getItem(DIRTY_KEY)
  } catch {
    return null
  }
}

export function marcarDirty(uid: string): void {
  try {
    localStorage.setItem(DIRTY_KEY, uid)
  } catch {
    /* modo incógnito, etc. */
  }
}

export function limpiarDirty(): void {
  try {
    localStorage.removeItem(DIRTY_KEY)
  } catch {
    /* noop */
  }
}

// ---- "base": huella de la última sincronización ----
// Recuerda QUÉ estado quedó sincronizado con la cuenta la última vez (por user id).
// Con eso, al reentrar sabemos quién se movió: si la nube sigue igual a la base,
// solo lo local avanzó → se sube solo; si lo local sigue igual a la base, solo la
// nube avanzó → se baja solo. La pregunta queda para la PRIMERA vez de la cuenta
// en este dispositivo, o si avanzaron los dos a la vez (ahí sí puede perderse algo).
const BASE_KEY = 'cmf-sync-base'

export function leerBase(uid: string): string | null {
  try {
    const raw = localStorage.getItem(BASE_KEY)
    if (!raw) return null
    const b = JSON.parse(raw) as { uid: string; huella: string }
    return b.uid === uid ? b.huella : null // la base de otra cuenta no vale
  } catch {
    return null
  }
}

export function guardarBase(uid: string, data: RemoteData): void {
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify({ uid, huella: huellaProgreso(data) }))
  } catch {
    /* modo incógnito, etc. */
  }
}

const emptyDB = (): DB => ({ states: {}, notas: {}, optNames: {}, custom: [] })

function leerDB(key: string): DB | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw)
    return {
      states: d.states ?? {},
      notas: d.notas ?? {},
      optNames: d.optNames ?? {},
      custom: d.custom ?? [],
      profile: d.profile,
    }
  } catch {
    return null
  }
}

/** Cuántas materias tienen algo cargado (estado no pendiente o nota). */
export function contarMarcadas(db: DB): number {
  const conEstado = Object.values(db.states).filter((e) => e !== 'pendiente').length
  return conEstado + Object.keys(db.notas).length
}

/** ¿Hay progreso real (más allá del perfil) en algún plan? Las materias custom
 *  también cuentan: las cargó el usuario a mano y pisarlas sería perder trabajo. */
export function hayProgreso(data: RemoteData | null): boolean {
  if (!data) return false
  return Object.values(data.planes).some(
    (db) =>
      contarMarcadas(db) > 0 || Object.keys(db.optNames).length > 0 || db.custom.length > 0,
  )
}

/** Total de materias marcadas en todos los planes (para el modal de conflicto). */
export function totalMarcadas(data: RemoteData | null): number {
  if (!data) return 0
  return Object.values(data.planes).reduce((n, db) => n + contarMarcadas(db), 0)
}

/** Snapshot del estado local COMPLETO (todas las carreras + plan activo). */
export function snapshotLocal(): RemoteData {
  const planes: Record<string, DB> = {}
  for (const p of PLANES) {
    const db = leerDB(storageKey(p.id))
    if (db) planes[p.id] = db
  }
  const consentimiento = leerConsent() ?? undefined
  return { version: 1, planActivo: planActivoId(), planes, consentimiento }
}

/**
 * Decisión al iniciar sesión, con la regla de oro "nunca perder datos sin preguntar":
 * - 'push'      → la cuenta está vacía, o solo lo local avanzó: sube lo local.
 * - 'pull'      → lo local está vacío, o solo la nube avanzó: baja lo remoto.
 * - 'nada'      → son iguales: no hay nada que hacer.
 * - 'conflicto' → ambos tienen progreso distinto y no se puede saber (o los dos
 *                 avanzaron a la vez): decide el usuario (modal).
 *
 * `dirtyLocal` = quedaron cambios locales sin subir (el usuario editó/borró y el
 * push no llegó antes del refresh). En ese caso lo local es más nuevo y manda:
 * un borrado reciente NO se resucita bajando la cuenta, y lo pendiente se flushea.
 *
 * `base` = huella de la última sincronización de ESTA cuenta en este dispositivo
 * (ver leerBase). Es lo que evita preguntar en cada cambio de dispositivo: si la
 * nube sigue igual a la base, solo lo local se movió → push; si lo local sigue
 * igual a la base, solo la nube se movió → pull. Sin base (primera vez de la
 * cuenta acá) o con los dos lados movidos, se pregunta.
 */
export function decidirMerge(
  remoto: RemoteData | null,
  local: RemoteData,
  dirtyLocal = false,
  base: string | null = null,
): 'push' | 'pull' | 'nada' | 'conflicto' {
  if (!hayProgreso(remoto)) return 'push'
  if (!hayProgreso(local)) return dirtyLocal ? 'push' : 'pull'
  if (igualProgreso(remoto!, local)) return dirtyLocal ? 'push' : 'nada'
  if (base !== null) {
    if (huellaProgreso(remoto) === base) return 'push' // solo lo local avanzó (p.ej. offline)
    if (huellaProgreso(local) === base) return 'pull' // solo la nube avanzó (otro dispositivo)
  }
  return 'conflicto'
}

/**
 * Huella canónica del PROGRESO (sin perfil, plan activo ni consentimiento).
 * Canónica en serio: claves ordenadas (el orden de inserción de dos dispositivos
 * no puede inventar diferencias), sin estados 'pendiente' explícitos (marcar y
 * desmarcar = nunca haberla tocado) y sin planes vacíos (presente-vacío = ausente).
 */
export function huellaProgreso(data: RemoteData | null): string {
  if (!data) return '{}'
  const orden = <T,>(o: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)))
  const planes: Record<string, unknown> = {}
  for (const id of Object.keys(data.planes).sort()) {
    const d = data.planes[id] ?? emptyDB()
    const s = orden(
      Object.fromEntries(Object.entries(d.states).filter(([, e]) => e !== 'pendiente')),
    )
    const n = orden(d.notas)
    const o = orden(d.optNames)
    if (
      Object.keys(s).length === 0 &&
      Object.keys(n).length === 0 &&
      Object.keys(o).length === 0 &&
      d.custom.length === 0
    )
      continue
    planes[id] = { s, n, o, c: d.custom }
  }
  return JSON.stringify(planes)
}

/** Compara solo el progreso (estados/notas/optNames/custom por plan), no el perfil. */
function igualProgreso(a: RemoteData, b: RemoteData): boolean {
  return huellaProgreso(a) === huellaProgreso(b)
}

/**
 * Escribe el estado remoto en el localStorage local (todas las carreras + plan
 * activo). NO recarga: eso lo decide el que llama (el orquestador, en el navegador).
 * Conserva el perfil local si el remoto no trae uno (la foto puede ser por-dispositivo).
 */
export function escribirLocal(data: RemoteData): void {
  for (const [planId, db] of Object.entries(data.planes)) {
    const key = storageKey(planId)
    const local = leerDB(key)
    const merged: DB = { ...db, profile: db.profile ?? local?.profile }
    localStorage.setItem(key, JSON.stringify(merged))
  }
  localStorage.setItem('cmf-plan-activo', data.planActivo)
  // el consentimiento viaja con los datos: aceptado en un dispositivo, vale en todos
  if (data.consentimiento) {
    try {
      localStorage.setItem('cmf-consent', JSON.stringify(data.consentimiento))
    } catch {
      /* noop */
    }
  }
}
