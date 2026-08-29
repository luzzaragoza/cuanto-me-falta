// El modelo académico como OBJETOS.
//
//   universidad 1───N plan 1───N materia
//                          plan 1───N correlativa   (materia → requiere materia)
//                          plan 1───N titulo         (hito al completar hasta cierto año)
//
// Cada clase mapea 1:1 a una tabla del backend (`supabase/001-datos-academicos.sql`) y
// se construye desde el JSON que describe `./json.ts`.
//
// DOS REGLAS QUE SOSTIENEN TODO ESTO:
//
// 1. **Las factories `desde()` son la única frontera.** `JSON.parse` devuelve objetos
//    planos, no instancias: si algún día alguien mete datos crudos sin pasar por acá,
//    `JSON.stringify` va a seguir funcionando y el bug va a ser silencioso. Por eso
//    todo lo que entra —bundle, backend, caché, borrador del editor— entra por acá.
//
// 2. **Construir NO valida las reglas del dominio.** `desde()` chequea la FORMA (que
//    los campos existan y sean del tipo correcto) y nada más. Que una correlativa
//    apunte a una materia inexistente, o que una optativa participe del grafo, lo dice
//    `validarPlan()`. Tiene que ser así: si el constructor rechazara los planes rotos,
//    el validador no podría recibir uno para *explicar qué tiene mal*, que es su
//    trabajo. Forma acá, reglas allá.
//
// Nota de estilo: los campos se declaran y se asignan a mano en vez de usar parameter
// properties (`constructor(readonly id: string)`) porque el proyecto tiene
// `erasableSyntaxOnly` activado — TypeScript solo puede BORRARSE, no generar código.
// Es más verboso y se banca.

import type {
  CorrelativaJSON,
  MateriaJSON,
  PlanJSON,
  TituloJSON,
  UniversidadJSON,
} from './json'

const esObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

/**
 * Un string, aunque venga vacío.
 *
 * Que esto acepte `''` NO es descuido: es la línea entre las dos responsabilidades.
 * "Es un string" es FORMA y se chequea acá; "no está vacío" es REGLA y la reporta
 * `validarPlan()` como `materia-invalida` o `plan-incompleto`. Si la factory rechazara
 * el vacío, un plan con una materia sin nombre no se podría ni construir, y entonces
 * el validador nunca podría explicar qué tiene mal — que es todo lo que hace.
 * El plan malo igual no llega a la pantalla: `sanear()` lo descarta después de que el
 * validador lo señaló.
 */
const cadena = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const numero = (v: unknown): number | null => (typeof v === 'number' ? v : null)

/** Una universidad. Tabla `universidad`. */
export class Universidad {
  readonly id: string
  readonly nombre: string

  constructor(id: string, nombre: string) {
    this.id = id
    this.nombre = nombre
  }

  static desde(j: unknown): Universidad | null {
    if (!esObj(j)) return null
    const id = cadena(j.id)
    const nombre = cadena(j.nombre)
    return id !== null && nombre !== null ? new Universidad(id, nombre) : null
  }

  aJSON(): UniversidadJSON {
    return { id: this.id, nombre: this.nombre }
  }
}

/**
 * Una materia dentro de un plan. Tabla `materia`, PK compuesta `(plan_id, cod)`:
 * el `cod` se repite ENTRE planes, nunca dentro de uno.
 */
export class MateriaPlan {
  readonly cod: string
  readonly nom: string
  readonly anio: number
  readonly cuatri: number
  /** Optativa: el alumno le pone el nombre (slot renombrable). */
  readonly opt: boolean
  /** Se habilita por requisito especial (por año o % de carrera), no por correlativa. */
  readonly especial: boolean

  constructor(
    cod: string,
    nom: string,
    anio: number,
    cuatri: number,
    opt = false,
    especial = false,
  ) {
    this.cod = cod
    this.nom = nom
    this.anio = anio
    this.cuatri = cuatri
    this.opt = opt
    this.especial = especial
  }

  static desde(j: unknown): MateriaPlan | null {
    if (!esObj(j)) return null
    const cod = cadena(j.cod)
    const nom = cadena(j.nom)
    const anio = numero(j.anio)
    const cuatri = numero(j.cuatri)
    if (cod === null || nom === null || anio === null || cuatri === null) return null
    return new MateriaPlan(cod, nom, anio, cuatri, j.opt === true, j.especial === true)
  }

  /**
   * La posición temporal de un año/cuatrimestre cualquiera, sin necesitar la materia.
   * Existe porque el editor la calcula sobre filas a medio cargar, que todavía no son
   * una `MateriaPlan`. La fórmula vive UNA vez, acá.
   */
  static indiceDe(anio: number, cuatri: number): number {
    return (anio - 1) * 2 + (cuatri - 1)
  }

  /**
   * Posición temporal absoluta en la carrera: 0 = 1°año/1°C, 1 = 1°año/2°C, 2 = 2°año/1°C…
   * Es el número con el que se compara "antes" y "después", y el que sostiene el
   * invariante del árbol (toda flecha fluye hacia abajo).
   */
  get indice(): number {
    return MateriaPlan.indiceDe(this.anio, this.cuatri)
  }

  /** ¿Se habilita por requisito y no por correlativas? (RN-05: optativas y especiales) */
  get porRequisito(): boolean {
    return this.opt || this.especial
  }

  /** ¿Está en un cuatrimestre estrictamente anterior al de la otra? */
  anteriorA(otra: MateriaPlan): boolean {
    return this.indice < otra.indice
  }

  /**
   * `opt` y `especial` salen solo cuando son `true`, igual que en los módulos del
   * bundle y que el `jsonb_strip_nulls` de la vista. Que la forma canónica se arme en
   * UN lugar es lo que permite comparar el bundle contra el backend y decir
   * "sin-cambios" sin falsos positivos (ver `igualRegistro`).
   */
  aJSON(): MateriaJSON {
    return {
      cod: this.cod,
      nom: this.nom,
      anio: this.anio,
      cuatri: this.cuatri,
      ...(this.opt ? { opt: true } : {}),
      ...(this.especial ? { especial: true } : {}),
    }
  }
}

/** Una correlativa: `cod` necesita `requiere` antes. Tabla `correlativa` (join). */
export class Correlativa {
  readonly cod: string
  readonly requiere: string

  constructor(cod: string, requiere: string) {
    this.cod = cod
    this.requiere = requiere
  }

  static desde(j: unknown): Correlativa | null {
    if (!esObj(j)) return null
    const cod = cadena(j.cod)
    const requiere = cadena(j.requiere)
    return cod !== null && requiere !== null ? new Correlativa(cod, requiere) : null
  }

  /** ¿Esta arista toca esa materia, en cualquiera de las dos puntas? */
  toca(cod: string): boolean {
    return this.cod === cod || this.requiere === cod
  }

  /** Una materia como correlativa de sí misma: dato imposible que el validador reporta. */
  get esAutoCorrelativa(): boolean {
    return this.cod === this.requiere
  }

  /** Clave para detectar repetidas. */
  get clave(): string {
    return `${this.cod}<-${this.requiere}`
  }

  aJSON(): CorrelativaJSON {
    return { cod: this.cod, requiere: this.requiere }
  }
}

/** Un título que otorga el plan al completar hasta cierto año. Tabla `titulo`. */
export class TituloPlan {
  readonly nombre: string
  /** Se consigue al aprobar todo hasta este año inclusive. */
  readonly hastaAnio: number
  /** Si el hito cae a mitad de año: hasta este cuatrimestre inclusive. */
  readonly hastaCuatri?: number

  constructor(nombre: string, hastaAnio: number, hastaCuatri?: number) {
    this.nombre = nombre
    this.hastaAnio = hastaAnio
    this.hastaCuatri = hastaCuatri
  }

  static desde(j: unknown): TituloPlan | null {
    if (!esObj(j)) return null
    const nombre = cadena(j.nombre)
    const hastaAnio = numero(j.hastaAnio)
    if (nombre === null || hastaAnio === null) return null
    const hastaCuatri = typeof j.hastaCuatri === 'number' ? j.hastaCuatri : undefined
    return new TituloPlan(nombre, hastaAnio, hastaCuatri)
  }

  /** ¿Una materia en ese año/cuatrimestre entra dentro de lo que el título exige? */
  incluye(anio: number, cuatri: number): boolean {
    if (anio < this.hastaAnio) return true
    return anio === this.hastaAnio && cuatri <= (this.hastaCuatri ?? Infinity)
  }

  aJSON(): TituloJSON {
    return {
      nombre: this.nombre,
      hastaAnio: this.hastaAnio,
      ...(this.hastaCuatri != null ? { hastaCuatri: this.hastaCuatri } : {}),
    }
  }
}

/**
 * Un plan de estudios: una versión concreta de una carrera. Tabla `plan` + sus hijas.
 *
 * Es el DATO del plan. El grafo con sus índices derivados y las preguntas que se le
 * hacen ("¿qué habilita esta materia?") viven en `domain/Plan`, que se construye a
 * partir de éste.
 */
export class PlanDef {
  readonly id: string
  readonly universidad: string
  readonly codigo: string
  readonly anio: number
  readonly carrera: string
  readonly materias: MateriaPlan[]
  readonly correlativas: Correlativa[]
  readonly titulos: TituloPlan[]

  constructor(
    id: string,
    universidad: string,
    codigo: string,
    anio: number,
    carrera: string,
    materias: MateriaPlan[],
    correlativas: Correlativa[],
    titulos: TituloPlan[],
  ) {
    this.id = id
    this.universidad = universidad
    this.codigo = codigo
    this.anio = anio
    this.carrera = carrera
    this.materias = materias
    this.correlativas = correlativas
    this.titulos = titulos
  }

  /**
   * Construye un plan desde JSON, o `null` si la forma no cierra.
   *
   * Devuelve `null` en vez de tirar porque el llamador principal es dato de RED (la
   * vista de Supabase, el caché): que llegue algo malformado no es excepcional, es
   * esperado, y la app tiene que seguir con el bundle. Para el bundle —donde un plan
   * roto es un bug del repo y tiene que romper el build— está `exigir()`.
   */
  static desde(j: unknown): PlanDef | null {
    if (!esObj(j)) return null
    const id = cadena(j.id)
    const universidad = cadena(j.universidad)
    const codigo = cadena(j.codigo)
    const carrera = cadena(j.carrera)
    const anio = numero(j.anio)
    if (id === null || universidad === null || codigo === null || carrera === null || anio === null) {
      return null
    }
    if (!Array.isArray(j.materias) || !Array.isArray(j.correlativas) || !Array.isArray(j.titulos)) {
      return null
    }

    const materias: MateriaPlan[] = []
    for (const m of j.materias) {
      const mat = MateriaPlan.desde(m)
      if (!mat) return null
      materias.push(mat)
    }
    const correlativas: Correlativa[] = []
    for (const c of j.correlativas) {
      const cor = Correlativa.desde(c)
      if (!cor) return null
      correlativas.push(cor)
    }
    const titulos: TituloPlan[] = []
    for (const t of j.titulos) {
      const tit = TituloPlan.desde(t)
      if (!tit) return null
      titulos.push(tit)
    }
    return new PlanDef(id, universidad, codigo, anio, carrera, materias, correlativas, titulos)
  }

  /** Igual que `desde()`, pero tira si la forma no cierra. Para el bundle y los tests. */
  static exigir(j: unknown): PlanDef {
    const p = PlanDef.desde(j)
    if (!p) throw new Error(`Plan mal formado: ${JSON.stringify(j).slice(0, 120)}…`)
    return p
  }

  aJSON(): PlanJSON {
    return {
      id: this.id,
      universidad: this.universidad,
      codigo: this.codigo,
      anio: this.anio,
      carrera: this.carrera,
      materias: this.materias.map((m) => m.aJSON()),
      correlativas: this.correlativas.map((c) => c.aJSON()),
      titulos: this.titulos.map((t) => t.aJSON()),
    }
  }
}
