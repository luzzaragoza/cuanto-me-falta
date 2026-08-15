// El estado del USUARIO como objetos: lo que marcó, lo que anotó y quién es.
//
// El otro mundo —los datos académicos, que son iguales para todos— vive en
// `data/model.ts`. El punto de unión entre los dos es el código de materia, y nada más.
//
// Mismas dos reglas que en `data/model.ts`:
//   · las factories `desde()` son la única frontera (esto entra por localStorage y por
//     la fila `progreso` de Supabase, o sea `JSON.parse` en los dos casos);
//   · construir no valida reglas, solo forma.
//
// Y una propia: **`DB` es inmutable**. Cada cambio devuelve una `DB` nueva. Eso no es
// preferencia de estilo: React detecta el cambio comparando referencias
// (`useSyncExternalStore`), así que mutar en el lugar significaría no repintar. Antes
// esa disciplina vivía desparramada en los spreads del `Store`; ahora la sostienen los
// métodos de acá, que son los únicos que saben construir la `DB` siguiente.

import type { PlanDef } from './data/model'

// ── El sobre (lo que viaja por JSON) ──────────────────────────────────────
export interface PerfilJSON {
  name: string
  photo: string
}
export interface MateriaCustomJSON {
  cod: string
  nom: string
  y: number
  c: number
}
export interface DBJSON {
  states: Record<string, Estado>
  notas: Record<string, number>
  optNames: Record<string, string>
  custom: MateriaCustomJSON[]
  profile?: PerfilJSON
}

// ── El dominio ────────────────────────────────────────────────────────────

/**
 * Estado de una materia. Es obligatorio; la nota es aparte y opcional.
 *
 * Queda como unión de literales y no como clase porque no hay ningún objeto que
 * modelar: son cuatro valores, sin campos ni conducta propia. Además la unión le da al
 * compilador algo que una clase no daría — chequeo de exhaustividad: si mañana se
 * agrega un quinto estado, TypeScript marca todos los `switch` que quedaron cortos.
 * Un enum haría lo mismo pero está prohibido por `erasableSyntaxOnly`.
 */
export type Estado = 'pendiente' | 'cursando' | 'final' | 'aprobada'

const ESTADOS: readonly Estado[] = ['pendiente', 'cursando', 'final', 'aprobada']

/** ¿Ese string es un estado válido? Se usa al leer datos guardados. */
export function esEstado(v: unknown): v is Estado {
  return typeof v === 'string' && (ESTADOS as readonly string[]).includes(v)
}

/** Perfil del usuario (queda solo en el navegador; nunca va a la analítica). */
export class Perfil {
  readonly name: string
  readonly photo: string

  constructor(name: string, photo = '') {
    this.name = name
    this.photo = photo
  }

  static desde(j: unknown): Perfil | null {
    if (typeof j !== 'object' || j === null) return null
    const o = j as Record<string, unknown>
    if (typeof o.name !== 'string') return null
    return new Perfil(o.name, typeof o.photo === 'string' ? o.photo : '')
  }

  /** Iniciales (hasta 2) para el avatar sin foto. Vivía suelta en `selectors`. */
  get iniciales(): string {
    return this.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('')
  }

  conNombre(name: string): Perfil {
    return new Perfil(name, this.photo)
  }

  aJSON(): PerfilJSON {
    return { name: this.name, photo: this.photo }
  }
}

/** Materia agregada a mano por el usuario (slot custom). */
export class MateriaCustom {
  readonly cod: string
  readonly nom: string
  /** Año y cuatrimestre donde el usuario la colgó. */
  readonly y: number
  readonly c: number

  constructor(cod: string, nom: string, y: number, c: number) {
    this.cod = cod
    this.nom = nom
    this.y = y
    this.c = c
  }

  static desde(j: unknown): MateriaCustom | null {
    if (typeof j !== 'object' || j === null) return null
    const o = j as Record<string, unknown>
    if (typeof o.cod !== 'string' || typeof o.nom !== 'string') return null
    if (typeof o.y !== 'number' || typeof o.c !== 'number') return null
    return new MateriaCustom(o.cod, o.nom, o.y, o.c)
  }

  aJSON(): MateriaCustomJSON {
    return { cod: this.cod, nom: this.nom, y: this.y, c: this.c }
  }
}

/**
 * Avance "espejado" desde las OTRAS carreras del usuario: para cada materia compartida
 * (mismo código en la misma universidad), el mejor estado y su nota registrados en otro
 * plan.
 *
 * Es DERIVADO y de solo lectura: la `DB` lo pone DEBAJO de las marcas propias al armar
 * la vista que ve la UI, pero nunca se persiste ni se exporta — cada plan sigue
 * guardando únicamente lo suyo. Ver `lib/espejo.ts`.
 */
export class Espejo {
  readonly states: Readonly<Record<string, Estado>>
  readonly notas: Readonly<Record<string, number>>

  constructor(states: Record<string, Estado> = {}, notas: Record<string, number> = {}) {
    this.states = states
    this.notas = notas
  }

  static vacio(): Espejo {
    return new Espejo()
  }

  /**
   * Calcula el espejo del plan activo a partir de las OTRAS carreras del usuario.
   * `otros` = cada otro plan con su DB guardada (los que no tienen datos, ni van).
   *
   * En una misma universidad, el mismo código de materia ES la misma materia: si la
   * aprobaste cursando una carrera, tiene que figurar aprobada en la otra (Ing.
   * Informática y Lic. en Gestión de TI comparten 22, por ejemplo).
   *
   * Es un espejo DERIVADO, no una copia: cada plan sigue guardando solo sus propias
   * marcas en su clave de localStorage (y eso es lo que viaja por el sync). Nada se
   * duplica —no hay dos copias que puedan divergir ni pisarse en un merge—, funciona
   * retroactivamente con el avance ya cargado, y una marca explícita del plan activo
   * siempre gana (de eso se encarga `bajo()`).
   *
   * Quedan afuera las optativas (el slot es una elección de cada plan, aunque el código
   * coincida) y las materias custom (sus códigos los inventa el usuario).
   */
  static deOtrasCarreras(
    plan: PlanDef,
    otros: Array<{ plan: PlanDef; db: DB }>,
  ): Espejo {
    /** Cuán avanzado es un estado — entre carreras gana el más avanzado. */
    const RANGO: Record<Estado, number> = { pendiente: 0, cursando: 1, final: 2, aprobada: 3 }
    const states: Record<string, Estado> = {}
    const notas: Record<string, number> = {}
    const propias = new Set(plan.materias.filter((m) => !m.opt).map((m) => m.cod))

    for (const otro of otros) {
      if (otro.plan.id === plan.id || otro.plan.universidad !== plan.universidad) continue
      for (const m of otro.plan.materias) {
        if (m.opt || !propias.has(m.cod)) continue
        const estado = otro.db.estado(m.cod)
        if (estado === 'pendiente') continue
        const actual = states[m.cod]
        if (actual && RANGO[actual] >= RANGO[estado]) continue
        states[m.cod] = estado
        // la nota acompaña al estado ganador (si su plan no tiene, no se inventa)
        const nota = otro.db.nota(m.cod)
        if (nota !== undefined) notas[m.cod] = nota
        else delete notas[m.cod]
      }
    }
    return new Espejo(states, notas)
  }

  get hayAlgo(): boolean {
    return Object.keys(this.states).length > 0
  }
}

/**
 * Todo el estado del usuario que persiste en el navegador, para UN plan.
 *
 * Inmutable: cada `con…()` devuelve una `DB` nueva (ver el comentario del encabezado).
 */
export class DB {
  readonly states: Readonly<Record<string, Estado>>
  readonly notas: Readonly<Record<string, number>>
  readonly optNames: Readonly<Record<string, string>>
  readonly custom: readonly MateriaCustom[]
  readonly profile?: Perfil

  constructor(
    states: Record<string, Estado> = {},
    notas: Record<string, number> = {},
    optNames: Record<string, string> = {},
    custom: readonly MateriaCustom[] = [],
    profile?: Perfil,
  ) {
    this.states = states
    this.notas = notas
    this.optNames = optNames
    this.custom = custom
    this.profile = profile
  }

  static vacia(): DB {
    return new DB()
  }

  /**
   * Lee una DB guardada. Nunca falla: lo que no se entiende se descarta y se sigue con
   * el resto. Perder una nota mal escrita es infinitamente mejor que no abrir la app.
   */
  static desde(j: unknown): DB {
    if (typeof j !== 'object' || j === null) return DB.vacia()
    const o = j as Record<string, unknown>

    const states: Record<string, Estado> = {}
    if (typeof o.states === 'object' && o.states !== null) {
      for (const [cod, v] of Object.entries(o.states)) if (esEstado(v)) states[cod] = v
    }
    const notas: Record<string, number> = {}
    if (typeof o.notas === 'object' && o.notas !== null) {
      for (const [cod, v] of Object.entries(o.notas)) if (typeof v === 'number') notas[cod] = v
    }
    const optNames: Record<string, string> = {}
    if (typeof o.optNames === 'object' && o.optNames !== null) {
      for (const [cod, v] of Object.entries(o.optNames)) if (typeof v === 'string') optNames[cod] = v
    }
    const custom = Array.isArray(o.custom)
      ? o.custom.map((c) => MateriaCustom.desde(c)).filter((c): c is MateriaCustom => c !== null)
      : []

    return new DB(states, notas, optNames, custom, Perfil.desde(o.profile) ?? undefined)
  }

  // ── lectura ────────────────────────────────────────────────────────────
  estado(cod: string): Estado {
    return this.states[cod] ?? 'pendiente'
  }
  nota(cod: string): number | undefined {
    return this.notas[cod]
  }
  optName(cod: string): string | undefined {
    return this.optNames[cod]
  }

  /** Cuántas materias tienen algo cargado (estado no pendiente, o nota). */
  get marcadas(): number {
    const conEstado = Object.values(this.states).filter((e) => e !== 'pendiente').length
    return conEstado + Object.keys(this.notas).length
  }

  /** ¿Hay alguna marca? (el perfil no cuenta: tener nombre no es haber avanzado) */
  get hayProgreso(): boolean {
    return (
      Object.keys(this.states).length > 0 ||
      Object.keys(this.notas).length > 0 ||
      Object.keys(this.optNames).length > 0 ||
      this.custom.length > 0
    )
  }

  // ── transiciones (siempre devuelven una DB nueva) ───────────────────────
  conEstado(cod: string, estado: Estado): DB {
    return this.copia({ states: { ...this.states, [cod]: estado } })
  }

  /**
   * Marca varias materias de una. `undefined` BORRA la marca, que es lo que hace falta
   * para deshacer con exactitud: una materia que no estaba marcada tiene que volver a
   * no estarlo. Devuelve también el cambio INVERSO, que es lo que guarda el "deshacer".
   */
  conEstados(cambios: Record<string, Estado | undefined>): {
    db: DB
    inverso: Record<string, Estado | undefined>
  } {
    const entradas = Object.entries(cambios)
    if (entradas.length === 0) return { db: this, inverso: {} }
    const states = { ...this.states }
    const inverso: Record<string, Estado | undefined> = {}
    for (const [cod, estado] of entradas) {
      inverso[cod] = states[cod] // sin marca → undefined → deshacer la borra
      if (estado === undefined) delete states[cod]
      else states[cod] = estado
    }
    return { db: this.copia({ states }), inverso }
  }

  /** La nota se acota a 1..10 y se redondea. `null` la borra. */
  conNota(cod: string, valor: number | null): DB {
    const notas = { ...this.notas }
    if (valor == null || Number.isNaN(valor)) delete notas[cod]
    else notas[cod] = Math.max(1, Math.min(10, Math.round(valor)))
    return this.copia({ notas })
  }

  /** Nombre de una optativa. Vacío la borra; se recorta a 48 caracteres. */
  conOptName(cod: string, nombre: string): DB {
    const optNames = { ...this.optNames }
    const v = nombre.trim()
    if (v === '') delete optNames[cod]
    else optNames[cod] = v.slice(0, 48)
    return this.copia({ optNames })
  }

  conPerfil(profile: Perfil): DB {
    return this.copia({ profile })
  }

  /**
   * La misma DB pero con OTRO mapa de estados. Lo usa el árbol cuando lo abre el
   * editor: ahí se dibuja un plan ajeno, y los estados no son los del alumno sino los
   * del modo edición. No se persiste nunca — igual que el espejo, es una vista.
   */
  conVistaDeEstados(states: Record<string, Estado>): DB {
    return new DB({ ...states }, { ...this.notas }, { ...this.optNames }, this.custom, this.profile)
  }

  /** Borra el avance pero deja el perfil: "reiniciar" no es "olvidar quién sos". */
  sinProgreso(): DB {
    return new DB({}, {}, {}, [], this.profile)
  }

  /**
   * La DB que ve la UI: el espejo de otras carreras DEBAJO de lo propio, así una
   * materia compartida ya aprobada en otra carrera figura aprobada acá, pero cualquier
   * marca explícita de este plan gana. El resultado NO se persiste nunca.
   */
  bajo(espejo: Espejo | undefined): DB {
    if (!espejo || !espejo.hayAlgo) return this
    return new DB(
      { ...espejo.states, ...this.states },
      { ...espejo.notas, ...this.notas },
      this.optNames,
      this.custom,
      this.profile,
    )
  }

  aJSON(): DBJSON {
    return {
      states: { ...this.states },
      notas: { ...this.notas },
      optNames: { ...this.optNames },
      custom: this.custom.map((c) => c.aJSON()),
      ...(this.profile ? { profile: this.profile.aJSON() } : {}),
    }
  }

  private copia(campos: {
    states?: Record<string, Estado>
    notas?: Record<string, number>
    optNames?: Record<string, string>
    custom?: readonly MateriaCustom[]
    profile?: Perfil
  }): DB {
    return new DB(
      campos.states ?? { ...this.states },
      campos.notas ?? { ...this.notas },
      campos.optNames ?? { ...this.optNames },
      campos.custom ?? this.custom,
      campos.profile ?? this.profile,
    )
  }
}
