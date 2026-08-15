// Lógica PURA del sync (sin Supabase, sin React): el snapshot local de todas las
// carreras, y la decisión de merge al iniciar sesión. Vive separada del orquestador
// (`state/sync.ts`) para poder testearla en node con un localStorage inyectado.

import { DB } from '../types'
import { PLANES } from '../data/planes'
import { PlanActivo } from '../state/planActivo'

/**
 * Consentimiento a los Términos y la Política de Privacidad (Ley 25.326).
 *
 * Viaja DENTRO del JSON del progreso, no en una tabla aparte: aceptás una vez por
 * cuenta y vale en todos tus dispositivos. Subir `VERSION` se lo vuelve a pedir a todo
 * el mundo, que es exactamente lo que hay que hacer si cambian los términos.
 */
export class Consentimiento {
  /** Versión vigente de los TyC/Privacidad. Subirla re-pide consentimiento. */
  static readonly VERSION = '2026-07'
  private static readonly KEY = 'cmf-consent'

  readonly version: string
  readonly fecha: string // ISO

  constructor(version: string, fecha: string) {
    this.version = version
    this.fecha = fecha
  }

  static desde(j: unknown): Consentimiento | null {
    if (typeof j !== 'object' || j === null) return null
    const o = j as Record<string, unknown>
    if (typeof o.version !== 'string' || typeof o.fecha !== 'string') return null
    return new Consentimiento(o.version, o.fecha)
  }

  static leer(): Consentimiento | null {
    try {
      const raw = localStorage.getItem(Consentimiento.KEY)
      return raw ? Consentimiento.desde(JSON.parse(raw)) : null
    } catch {
      return null
    }
  }

  /** Registra la aceptación de la versión vigente. */
  static aceptar(): Consentimiento {
    const c = new Consentimiento(Consentimiento.VERSION, new Date().toISOString())
    c.guardar()
    return c
  }

  guardar(): void {
    try {
      localStorage.setItem(Consentimiento.KEY, JSON.stringify(this.aJSON()))
    } catch {
      /* modo incógnito, etc. */
    }
  }

  /** ¿Cubre la versión que rige hoy? */
  get vigente(): boolean {
    return this.version === Consentimiento.VERSION
  }

  aJSON(): { version: string; fecha: string } {
    return { version: this.version, fecha: this.fecha }
  }
}

/**
 * Lo que viaja a la fila `progreso` de Supabase (columna `data`, JSON), y lo que se
 * guarda como base de la ultima sincronizacion.
 *
 * Es clase por la misma razon que `DB`: entra por `JSON.parse` en DOS fronteras —la
 * respuesta de Supabase y la base en localStorage— y adentro lleva `DB`s, que sin
 * rehidratar serian objetos planos sin metodos. `desde()` es el unico lugar donde eso
 * se arma.
 */
export class RemoteData {
  readonly version = 1 as const
  readonly planActivo: string
  /** DB completa por plan, indexada por id de plan (solo los que tienen algo). */
  readonly planes: Readonly<Record<string, DB>>
  /** Registro del consentimiento (viaja con los datos: aceptas una vez por cuenta). */
  readonly consentimiento?: Consentimiento

  constructor(
    planActivo: string,
    planes: Record<string, DB>,
    consentimiento?: Consentimiento,
  ) {
    this.planActivo = planActivo
    this.planes = planes
    this.consentimiento = consentimiento
  }

  static desde(j: unknown): RemoteData | null {
    if (typeof j !== 'object' || j === null) return null
    const o = j as Record<string, unknown>
    if (typeof o.planActivo !== 'string') return null
    const planes: Record<string, DB> = {}
    if (typeof o.planes === 'object' && o.planes !== null) {
      for (const [id, db] of Object.entries(o.planes as Record<string, unknown>)) {
        planes[id] = DB.desde(db)
      }
    }
    const c = o.consentimiento as Consentimiento | undefined
    const consentimiento =
      c && typeof c.version === 'string' && typeof c.fecha === 'string' ? c : undefined
    return new RemoteData(o.planActivo, planes, consentimiento)
  }

  aJSON(): unknown {
    return {
      version: this.version,
      planActivo: this.planActivo,
      planes: Object.fromEntries(
        Object.entries(this.planes).map(([id, db]) => [id, db.aJSON()]),
      ),
      ...(this.consentimiento ? { consentimiento: this.consentimiento } : {}),
    }
  }

  // ── preguntas sobre este estado ──────────────────────────────────────────

  /**
   * ¿Hay progreso real (más allá del perfil)? Las materias custom también cuentan:
   * las cargó el usuario a mano y pisarlas sería perder trabajo.
   */
  get hayProgreso(): boolean {
    return Object.values(this.planes).some(
      (db) => db.marcadas > 0 || Object.keys(db.optNames).length > 0 || db.custom.length > 0,
    )
  }

  /** Total de materias marcadas en todos los planes (para el modal de conflicto). */
  get totalMarcadas(): number {
    return Object.values(this.planes).reduce((n, db) => n + db.marcadas, 0)
  }

  /**
   * Huella canónica del PROGRESO (sin perfil, plan activo ni consentimiento).
   *
   * Canónica en serio: claves ordenadas (el orden de inserción de dos dispositivos no
   * puede inventar diferencias), sin estados 'pendiente' explícitos (marcar y desmarcar
   * = nunca haberla tocado) y sin planes vacíos (presente-vacío = ausente). Sin esto,
   * dos dispositivos con exactamente los mismos datos parecerían distintos y el modal de
   * conflicto saltaría por nada.
   */
  get huella(): string {
    return huellaDe(this)
  }

  /** ¿Tiene el mismo progreso que el otro? (el perfil no cuenta) */
  igualProgresoQue(otro: RemoteData): boolean {
    return this.huella === otro.huella
  }


  /** Snapshot del estado local COMPLETO (todas las carreras + plan activo). */
  static local(): RemoteData {
    return armarSnapshotLocal()
  }

  /**
   * Qué hacer al iniciar sesión, con la regla de oro "nunca perder datos sin preguntar".
   * Ver el comentario largo de `decidir`.
   */
  static decidir(
    remoto: RemoteData | null,
    local: RemoteData,
    dirtyLocal = false,
    base: string | null = null,
  ): 'push' | 'pull' | 'nada' | 'conflicto' {
    return decidir(remoto, local, dirtyLocal, base)
  }

  /**
   * Fusión de a tres: `this` es la BASE (lo último sincronizado). Si local y nube
   * avanzaron en materias distintas, se combinan sin preguntar; si tocaron la MISMA
   * materia con valores distintos, devuelve `null` y decide el usuario.
   */
  fusionar(local: RemoteData, remoto: RemoteData): RemoteData | null {
    return fusionarDeATres(this, local, remoto)
  }

  /**
   * Escribe este estado en el localStorage (todas las carreras + plan activo).
   * NO recarga: eso lo decide el orquestador.
   */
  escribirLocal(): void {
    volcarALocal(this)
  }

}

/**
 * "Quedaron cambios locales sin subir".
 *
 * Marca que sobrevive al refresh: si el usuario borra o edita y recarga ANTES de que el
 * push con debounce llegue al server, el merge inicial NO debe resucitar lo borrado
 * bajándolo de la cuenta — lo local es más nuevo. Guarda el user id para que el flag de
 * una cuenta no le gane datos a otra en el mismo navegador.
 */
export class MarcaSinSubir {
  private static readonly KEY = 'cmf-sync-dirty'

  /** El user id que dejó cambios sin subir, o `null`. */
  static de(): string | null {
    try {
      return localStorage.getItem(MarcaSinSubir.KEY)
    } catch {
      return null
    }
  }

  /** ¿Es de ESTA cuenta? Un flag ajeno no vale (y se descarta al entrar). */
  static esDe(uid: string): boolean {
    return MarcaSinSubir.de() === uid
  }

  static poner(uid: string): void {
    try {
      localStorage.setItem(MarcaSinSubir.KEY, uid)
    } catch {
      /* modo incógnito, etc. */
    }
  }

  static limpiar(): void {
    try {
      localStorage.removeItem(MarcaSinSubir.KEY)
    } catch {
      /* noop */
    }
  }
}

// ---- "base": la última sincronización ----
// Recuerda QUÉ estado quedó sincronizado con la cuenta la última vez (por user id):
// la huella (para decidir rápido quién se movió) y la data completa (para poder
// FUSIONAR cuando se movieron los dos). Si la nube sigue igual a la base, solo lo
// local avanzó → se sube solo; si lo local sigue igual a la base, solo la nube
// avanzó → se baja solo; si avanzaron los dos en materias distintas → merge3 los
// fusiona sin preguntar. La pregunta queda para la PRIMERA vez de la cuenta en
// este dispositivo, o si tocaron la MISMA materia con valores distintos.
/** Qué estado quedó sincronizado con la cuenta la última vez. */
export class Base {
  private static readonly KEY = 'cmf-sync-base'

  readonly huella: string
  /**
   * Data completa de la última sincronización (habilita `fusionar`). Puede faltar en
   * bases guardadas por builds anteriores — ahí solo vale la huella.
   */
  readonly data?: RemoteData

  constructor(huella: string, data?: RemoteData) {
    this.huella = huella
    this.data = data
  }

  static leer(uid: string): Base | null {
    try {
      const raw = localStorage.getItem(Base.KEY)
      if (!raw) return null
      const b = JSON.parse(raw) as { uid: string; huella: string; data?: unknown }
      if (b.uid !== uid) return null // la de otra cuenta no vale
      return new Base(b.huella, RemoteData.desde(b.data) ?? undefined)
    } catch {
      return null
    }
  }

  static guardar(uid: string, data: RemoteData): void {
    try {
      localStorage.setItem(
        Base.KEY,
        JSON.stringify({ uid, huella: data.huella, data: data.aJSON() }),
      )
    } catch {
      /* modo incógnito, etc. */
    }
  }
}

function leerDB(key: string): DB | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return DB.desde(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Snapshot del estado local COMPLETO (todas las carreras + plan activo). */
function armarSnapshotLocal(): RemoteData {
  const planes: Record<string, DB> = {}
  for (const p of PLANES) {
    const db = leerDB(PlanActivo.claveDe(p.id))
    if (db) planes[p.id] = db
  }
  return new RemoteData(PlanActivo.id(), planes, Consentimiento.leer() ?? undefined)
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
function decidir(
  remoto: RemoteData | null,
  local: RemoteData,
  dirtyLocal = false,
  base: string | null = null,
): 'push' | 'pull' | 'nada' | 'conflicto' {
  if (!remoto?.hayProgreso) return 'push'
  if (!local.hayProgreso) return dirtyLocal ? 'push' : 'pull'
  if (remoto.igualProgresoQue(local)) return dirtyLocal ? 'push' : 'nada'
  if (base !== null) {
    if (remoto.huella === base) return 'push' // solo lo local avanzó (p.ej. offline)
    if (local.huella === base) return 'pull' // solo la nube avanzó (otro dispositivo)
  }
  return 'conflicto'
}

/**
 * Huella canónica del PROGRESO (sin perfil, plan activo ni consentimiento).
 * Canónica en serio: claves ordenadas (el orden de inserción de dos dispositivos
 * no puede inventar diferencias), sin estados 'pendiente' explícitos (marcar y
 * desmarcar = nunca haberla tocado) y sin planes vacíos (presente-vacío = ausente).
 */
function huellaDe(data: RemoteData | null): string {
  if (!data) return '{}'
  const orden = <T,>(o: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)))
  const planes: Record<string, unknown> = {}
  for (const id of Object.keys(data.planes).sort()) {
    const d = data.planes[id] ?? DB.vacia()
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

// ---- fusión de a tres (local y nube avanzaron a la vez) ----

const sinPendientes = (s: DB['states']): DB['states'] =>
  Object.fromEntries(Object.entries(s).filter(([, e]) => e !== 'pendiente'))

/**
 * Fusiona un registro clave→valor tomando de cada lado lo que CAMBIÓ respecto
 * de la base. Si los dos lados tocaron la MISMA clave con valores distintos,
 * devuelve null: conflicto real, lo decide el usuario.
 */
function fusionRegistro<T>(
  b: Record<string, T>,
  l: Record<string, T>,
  r: Record<string, T>,
): Record<string, T> | null {
  const out: Record<string, T> = {}
  const j = (v: T | undefined) => JSON.stringify(v ?? null)
  for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
    let v: T | undefined
    if (j(l[k]) === j(r[k])) v = l[k]
    else if (j(l[k]) === j(b[k])) v = r[k] // solo la nube lo tocó
    else if (j(r[k]) === j(b[k])) v = l[k] // solo lo local lo tocó
    else return null // los dos lo tocaron distinto
    if (v !== undefined) out[k] = v
  }
  return out
}

/**
 * Fusión de a tres: la base común (última sincronización) contra lo local y la
 * nube. Cada lado aporta lo que cambió; borrar en un lado y no tocar en el otro
 * queda borrado. Devuelve null solo si tocaron la misma materia con valores
 * distintos en ambos lados — ahí no hay fusión sin perder algo, y se pregunta.
 */
function fusionarDeATres(base: RemoteData, local: RemoteData, remoto: RemoteData): RemoteData | null {
  const ids = new Set([
    ...Object.keys(base.planes),
    ...Object.keys(local.planes),
    ...Object.keys(remoto.planes),
  ])
  const planes: Record<string, DB> = {}
  for (const id of ids) {
    const b = base.planes[id] ?? DB.vacia()
    const l = local.planes[id] ?? DB.vacia()
    const r = remoto.planes[id] ?? DB.vacia()
    const states = fusionRegistro(sinPendientes(b.states), sinPendientes(l.states), sinPendientes(r.states))
    const notas = fusionRegistro(b.notas, l.notas, r.notas)
    const optNames = fusionRegistro(b.optNames, l.optNames, r.optNames)
    const porCod = (c: DB['custom']) => Object.fromEntries(c.map((m) => [m.cod, m]))
    const custom = fusionRegistro(porCod(b.custom), porCod(l.custom), porCod(r.custom))
    if (!states || !notas || !optNames || !custom) return null
    // la foto/nombre pueden ser por-dispositivo
    planes[id] = new DB(states, notas, optNames, Object.values(custom), l.profile ?? r.profile)
  }
  return new RemoteData(
    local.planActivo,
    planes,
    remoto.consentimiento ?? local.consentimiento,
  )
}

/**
 * Escribe el estado remoto en el localStorage local (todas las carreras + plan
 * activo). NO recarga: eso lo decide el que llama (el orquestador, en el navegador).
 * Conserva el perfil local si el remoto no trae uno (la foto puede ser por-dispositivo).
 */
function volcarALocal(data: RemoteData): void {
  for (const [planId, db] of Object.entries(data.planes)) {
    const key = PlanActivo.claveDe(planId)
    const local = leerDB(key)
    const perfil = db.profile ?? local?.profile
    const merged = perfil ? db.conPerfil(perfil) : db
    localStorage.setItem(key, JSON.stringify(merged.aJSON()))
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
