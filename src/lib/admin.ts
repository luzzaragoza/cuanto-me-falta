// Quién puede qué en la administración de planes — la parte PURA.
//
// La base es la que manda: las políticas de RLS deciden de verdad quién puede escribir
// qué (ver `supabase/002-perfiles-y-permisos.sql`). Esto es solo para que la interfaz
// sepa qué mostrar y qué deshabilitar: nunca es la única defensa. Si algo de acá dijera
// "sí" y la base "no", gana la base — y el editor muestra el error crudo.
//
// Vive en `lib/` y no toca I/O, así se prueban todas las combinaciones sin backend.

// ── El sobre ──────────────────────────────────────────────────────────────
export interface HabilitacionJSON {
  universidad_id: string
  crear: boolean
  editar: boolean
  eliminar: boolean
}

export type Rol = 'superadmin' | 'admin_uni' | 'estudiante'

const ROLES: readonly Rol[] = ['superadmin', 'admin_uni', 'estudiante']
const esRol = (v: unknown): v is Rol => typeof v === 'string' && (ROLES as readonly string[]).includes(v)

/** En qué estado está el acceso a `#admin`, que es lo que decide qué pantalla mostrar. */
export type Acceso =
  | 'cargando'
  | 'sin-backend' // la app corre sin credenciales de Supabase (dev/CI)
  | 'sin-sesion' // hay que iniciar sesión
  | 'sin-permiso' // sesión válida, pero esta cuenta no administra nada
  | 'ok'

/**
 * Lo que un admin puede hacer en UNA universidad (fila de `admin_uni`).
 *
 * El CUÁNTOS planes no está acá: `limite_planes` es de la universidad, no de la pareja
 * (persona, universidad). Cuando vivía en esta fila, dos admins de la misma facultad con
 * límites distintos hacían que el cupo real dependiera de quién apretaba el botón
 * (corregido en la migración 006).
 */
export class Habilitacion {
  readonly universidad_id: string
  readonly crear: boolean
  readonly editar: boolean
  readonly eliminar: boolean

  constructor(universidad_id: string, crear = false, editar = true, eliminar = false) {
    this.universidad_id = universidad_id
    this.crear = crear
    this.editar = editar
    this.eliminar = eliminar
  }

  static desde(j: unknown): Habilitacion | null {
    if (typeof j !== 'object' || j === null) return null
    const o = j as Record<string, unknown>
    if (typeof o.universidad_id !== 'string') return null
    return new Habilitacion(o.universidad_id, o.crear === true, o.editar === true, o.eliminar === true)
  }

  /** ¿Habilita esa acción? */
  permite(accion: 'crear' | 'editar' | 'eliminar'): boolean {
    return accion === 'crear' ? this.crear : accion === 'editar' ? this.editar : this.eliminar
  }
}

/**
 * La sesión de quien entró a `#admin`: su rol y en qué universidades está habilitado.
 *
 * Antes esto era un objeto plano y cinco funciones que lo recibían como primer
 * parámetro (`puedeEditar(perfil, uni)`, `cupoDe(perfil, uni, …)`) — el olor clásico de
 * un método disfrazado de función.
 */
export class SesionAdmin {
  readonly rol: Rol
  /** Habilitaciones por universidad. Para el superadmin no hace falta ninguna. */
  readonly habilitaciones: readonly Habilitacion[]

  constructor(rol: Rol, habilitaciones: readonly Habilitacion[] = []) {
    this.rol = rol
    this.habilitaciones = habilitaciones
  }

  /** Lo que se asume de una cuenta sin fila en `perfil` — igual que la base. */
  static estudiante(): SesionAdmin {
    return new SesionAdmin('estudiante')
  }

  static desde(rol: unknown, habilitaciones: unknown): SesionAdmin {
    const hs = Array.isArray(habilitaciones)
      ? habilitaciones.map((h) => Habilitacion.desde(h)).filter((h): h is Habilitacion => h !== null)
      : []
    return new SesionAdmin(esRol(rol) ? rol : 'estudiante', hs)
  }

  /**
   * Decide el acceso con lo que se sabe. `sesion === null` = todavía no cargó.
   * Es estático porque tiene que poder responder ANTES de que exista la sesión.
   */
  static acceso(hayBackend: boolean, haySesion: boolean, sesion: SesionAdmin | null): Acceso {
    if (!hayBackend) return 'sin-backend'
    if (!haySesion) return 'sin-sesion'
    if (sesion === null) return 'cargando'
    if (sesion.esSuper) return 'ok'
    return sesion.habilitaciones.length > 0 ? 'ok' : 'sin-permiso'
  }

  /** ¿Puede en todas las universidades, sin fila de habilitación? */
  get esSuper(): boolean {
    return this.rol === 'superadmin'
  }

  /** Habilitación en una universidad, o `undefined` si no tiene. */
  habilitacionEn(uni: string): Habilitacion | undefined {
    return this.habilitaciones.find((h) => h.universidad_id === uni)
  }

  private permite(uni: string, accion: 'crear' | 'editar' | 'eliminar'): boolean {
    return this.esSuper || this.habilitacionEn(uni)?.permite(accion) === true
  }

  puedeEditar(uni: string): boolean {
    return this.permite(uni, 'editar')
  }

  puedeEliminar(uni: string): boolean {
    return this.permite(uni, 'eliminar')
  }

  /** Las universidades que administra (para filtrar la lista de planes). */
  get universidades(): string[] {
    return this.habilitaciones.map((h) => h.universidad_id)
  }

  /**
   * Cupo de planes de una universidad. `limiteUni` sale de la fila de `universidad`, no
   * de la habilitación: el cupo es de la facultad y da el mismo número sin importar qué
   * admin pregunte. La que manda igual es la base — `limite_ok()` lo vuelve a chequear
   * en la política de INSERT.
   */
  cupoEn(uni: string, planesActuales: number, limiteUni: number): Cupo {
    if (this.esSuper) return Cupo.sinLimite(planesActuales)
    const h = this.habilitacionEn(uni)
    if (!h || !h.crear) return Cupo.sinPermiso(planesActuales, limiteUni)
    return new Cupo(planesActuales, limiteUni, true)
  }
}

/** Cuántos planes hay, cuántos permite la universidad y si entra otro. */
export class Cupo {
  readonly usados: number
  /** `null` = sin límite (superadmin). */
  readonly limite: number | null
  private readonly habilitadoACrear: boolean

  constructor(usados: number, limite: number | null, habilitadoACrear: boolean) {
    this.usados = usados
    this.limite = limite
    this.habilitadoACrear = habilitadoACrear
  }

  static sinLimite(usados: number): Cupo {
    return new Cupo(usados, null, true)
  }

  static sinPermiso(usados: number, limite: number): Cupo {
    return new Cupo(usados, limite, false)
  }

  get disponibles(): number | null {
    if (this.limite === null) return null
    return Math.max(0, this.limite - this.usados)
  }

  get puedeCrear(): boolean {
    if (!this.habilitadoACrear) return false
    return this.disponibles === null || this.disponibles > 0
  }

  /** Texto listo para la UI. */
  get leyenda(): string {
    if (this.limite === null) {
      return `${this.usados} ${this.usados === 1 ? 'plan' : 'planes'} · sin límite`
    }
    if (!this.habilitadoACrear) {
      return `${this.usados} de ${this.limite} · no podés crear planes nuevos`
    }
    const libres = this.disponibles ?? 0
    return libres > 0
      ? `${this.usados} de ${this.limite} · podés crear ${libres} más`
      : `${this.usados} de ${this.limite} · llegaste al límite`
  }
}

/**
 * Un plan tal como lo lista la administración (incluye los no publicados).
 *
 * Las dos preguntas que la lista le hace —"¿qué versión ven los alumnos?" y "¿tiene
 * cambios sin publicar?"— vivían como funciones sueltas en este mismo archivo. Son
 * preguntas sobre esta fila, así que ahora son suyas.
 */
export class PlanAdmin {
  readonly id: string
  readonly universidad_id: string
  readonly codigo: string
  readonly anio: number
  readonly carrera: string
  readonly estado: string
  readonly version_publicada: number | null
  readonly actualizado_at: string | null
  readonly publicado_at: string | null

  constructor(campos: {
    id: string
    universidad_id: string
    codigo: string
    anio: number
    carrera: string
    estado: string
    version_publicada: number | null
    actualizado_at: string | null
    publicado_at: string | null
  }) {
    this.id = campos.id
    this.universidad_id = campos.universidad_id
    this.codigo = campos.codigo
    this.anio = campos.anio
    this.carrera = campos.carrera
    this.estado = campos.estado
    this.version_publicada = campos.version_publicada
    this.actualizado_at = campos.actualizado_at
    this.publicado_at = campos.publicado_at
  }

  static desde(j: unknown): PlanAdmin | null {
    if (typeof j !== 'object' || j === null) return null
    const o = j as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.universidad_id !== 'string') return null
    const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)
    const txt = (v: unknown): string | null => (typeof v === 'string' ? v : null)
    return new PlanAdmin({
      id: o.id,
      universidad_id: o.universidad_id,
      codigo: txt(o.codigo) ?? '',
      anio: num(o.anio) ?? 0,
      carrera: txt(o.carrera) ?? '',
      estado: txt(o.estado) ?? 'borrador',
      version_publicada: num(o.version_publicada),
      actualizado_at: txt(o.actualizado_at),
      publicado_at: txt(o.publicado_at),
    })
  }

  /** ¿Hay una foto que los alumnos estén viendo? */
  get visible(): boolean {
    return this.estado === 'publicado' && this.version_publicada !== null
  }

  /** Cómo se muestra el estado en la lista. */
  get etiquetaEstado(): string {
    return this.visible ? `Publicado · v${this.version_publicada}` : 'Sin publicar'
  }

  /**
   * ¿El borrador tiene cambios sin publicar? Se compara la última edición de las filas
   * contra cuándo se publicó la foto que está viendo el alumno.
   */
  get tieneCambiosSinPublicar(): boolean {
    if (!this.actualizado_at) return false
    if (!this.publicado_at) return true
    const a = Date.parse(this.actualizado_at)
    const p = Date.parse(this.publicado_at)
    if (Number.isNaN(a) || Number.isNaN(p)) return false
    // 2s de tolerancia: publicar toca la fila del plan, así que los dos sellos quedan
    // casi iguales y no queremos que eso se vea como "tiene cambios sin publicar".
    return a - p > 2000
  }
}

/**
 * Los datos de un plan que se está por crear, y si están listos.
 *
 * El `id` de un plan es PERMANENTE: es la clave con la que cada alumno tiene guardado su
 * progreso en su dispositivo (`plan-<id>-v3`). Renombrarlo dejaría huérfano el avance de
 * todos, así que no se puede editar después (ni la migración 005 lo cascadea, a
 * propósito). Por eso se genera solo, a partir de datos que ya escribió la persona, y se
 * muestra para que lo vea antes de confirmar.
 */
export class PlanNuevo {
  readonly universidad: string
  readonly carrera: string
  readonly codigo: string
  readonly anio: number

  constructor(campos: { universidad: string; carrera: string; codigo: string; anio: number }) {
    this.universidad = campos.universidad
    this.carrera = campos.carrera
    this.codigo = campos.codigo
    this.anio = campos.anio
  }

  /** Texto a slug: sin acentos, sin símbolos, separado por guiones. */
  static slug(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // saca las marcas de acento
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
  }

  /**
   * Id sugerido: `<universidad>-<carrera>`. Si ya existe, agrega un sufijo numérico en
   * vez de fallar (dos carreras con nombre parecido son de lo más común).
   */
  idSugerido(existentes: string[]): string {
    const base =
      [PlanNuevo.slug(this.universidad), PlanNuevo.slug(this.carrera)].filter(Boolean).join('-') ||
      'plan'
    if (!existentes.includes(base)) return base
    for (let n = 2; n < 100; n++) {
      const con = `${base}-${n}`
      if (!existentes.includes(con)) return con
    }
    return `${base}-${Date.now()}`
  }

  /**
   * Qué falta para poder crearlo, en español. Vacío = está listo. El año se acota a algo
   * plausible: un plan de 1800 o de 2200 es un dedazo.
   */
  problemas(anioActual: number): string[] {
    const p: string[] = []
    if (!this.universidad.trim()) p.push('Elegí la universidad.')
    if (!this.carrera.trim()) p.push('Escribí el nombre de la carrera.')
    if (!this.codigo.trim()) p.push('Escribí el código del plan (el que usa la facultad).')
    if (!Number.isInteger(this.anio) || this.anio < 1950 || this.anio > anioActual + 5) {
      p.push(`El año de vigencia tiene que estar entre 1950 y ${anioActual + 5}.`)
    }
    return p
  }

  listo(anioActual: number): boolean {
    return this.problemas(anioActual).length === 0
  }
}
