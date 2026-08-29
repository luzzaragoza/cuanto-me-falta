import { MateriaPlan, PlanDef, TituloPlan } from '../data/model'
import { getPlanDef } from '../data/planes'
import { PlanActivo } from '../state/planActivo'

/**
 * Una materia junto con dónde vive en la grilla.
 *
 * Compone la `MateriaPlan` en vez de heredarla: una materia ubicada no *es* otra clase
 * de materia, es la misma materia mirada desde la grilla. Los accesos directos (`cod`,
 * `nom`, …) delegan, así quien la usa no tiene que saber de la composición.
 */
export class MateriaUbicada {
  readonly materia: MateriaPlan
  /** Índice de año (0-based) e índice de cuatrimestre dentro del año (0-based). */
  readonly yi: number
  readonly ci: number

  constructor(materia: MateriaPlan, yi: number, ci: number) {
    this.materia = materia
    this.yi = yi
    this.ci = ci
  }

  get cod(): string {
    return this.materia.cod
  }
  get nom(): string {
    return this.materia.nom
  }
  /** Año de la carrera (1-based), como lo llama la UI. */
  get year(): number {
    return this.materia.anio
  }
  /** Número de cuatrimestre dentro del año (1 | 2). */
  get cuatri(): number {
    return this.materia.cuatri
  }
}

/** Un cuatrimestre dentro de un año. Puede otorgar un título si el hito cae a mitad de año. */
export class Cuatri {
  /** Número de cuatrimestre dentro del año (1 | 2). */
  readonly n: number
  readonly mats: readonly MateriaPlan[]
  readonly titulo?: string

  constructor(n: number, mats: readonly MateriaPlan[], titulo?: string) {
    this.n = n
    this.mats = mats
    this.titulo = titulo
  }
}

/** Un año del plan. Algunos otorgan un título al completarse. */
export class Anio {
  readonly year: number
  readonly cuatris: readonly Cuatri[]
  readonly titulo?: string

  constructor(year: number, cuatris: readonly Cuatri[], titulo?: string) {
    this.year = year
    this.cuatris = cuatris
    this.titulo = titulo
  }

  /** Todas las materias del año, en orden. */
  get mats(): MateriaPlan[] {
    return this.cuatris.flatMap((q) => [...q.mats])
  }
}

/**
 * Grafo estático de un plan de carrera: materias + correlativas + títulos.
 *
 * Se construye desde un `PlanDef` (el dato) y arma en el constructor los índices que
 * hacen baratas las preguntas: por código, hacia atrás y hacia adelante. No conoce el
 * estado del usuario (eso vive en la `DB`); solo responde sobre la estructura.
 *
 * ⚠️ Se puede construir con un plan ROTO, a propósito: es lo que le permite a
 * `validarPlan()` recibir uno y explicar qué tiene mal. Los métodos de acá no asumen
 * que el grafo cierre.
 */
export class Plan {
  readonly def: PlanDef
  readonly anios: readonly Anio[]
  /** materia → sus previas directas. */
  private readonly previas: Map<string, string[]>
  /**
   * materia → las que la tienen como previa. Es el índice INVERSO, y existe para que
   * `despues()` no recorra el grafo entero en cada llamada: antes filtraba todas las
   * claves con un `includes`, y `chainDown()` la llama una vez por nodo (o sea, era
   * cuadrático sobre el plan). Cuesta un Map más en el constructor.
   */
  private readonly posteriores: Map<string, string[]>
  private readonly porCod: Map<string, MateriaPlan>

  constructor(def: PlanDef) {
    this.def = def
    this.porCod = new Map(def.materias.map((m) => [m.cod, m]))
    this.previas = new Map()
    this.posteriores = new Map()
    for (const c of def.correlativas) {
      this.previas.set(c.cod, [...(this.previas.get(c.cod) ?? []), c.requiere])
      this.posteriores.set(c.requiere, [...(this.posteriores.get(c.requiere) ?? []), c.cod])
    }
    this.anios = this.armarAnios()
  }

  /** Nombre de la carrera (ej. 'Ingeniería en Informática'). */
  get carrera(): string {
    return this.def.carrera
  }

  /** Lista plana de todas las materias del plan, con su ubicación. */
  materias(): MateriaUbicada[] {
    const out: MateriaUbicada[] = []
    this.anios.forEach((a, yi) =>
      a.cuatris.forEach((q, ci) => q.mats.forEach((m) => out.push(new MateriaUbicada(m, yi, ci)))),
    )
    return out
  }

  /** Materias que exige un título: todas hasta su año/cuatrimestre inclusive. */
  materiasHasta(t: TituloPlan): MateriaUbicada[] {
    return this.materias().filter((m) => t.incluye(m.year, m.cuatri))
  }

  /** Materias de un año que toca el interruptor de año: todas menos las optativas
   *  (no sabemos cuál eligió el alumno, se marcan a mano). */
  codsDelAnio(year: number): string[] {
    return this.def.materias.filter((m) => m.anio === year && !m.opt).map((m) => m.cod)
  }

  /** Nombre base de una materia por código (sin nombres custom de optativas). */
  nombre(cod: string): string {
    return this.porCod.get(cod)?.nom ?? cod
  }

  /** La materia por código, si existe. */
  materia(cod: string): MateriaPlan | undefined {
    return this.porCod.get(cod)
  }

  /** Títulos que otorga el plan (hitos). */
  titulos(): readonly TituloPlan[] {
    return this.def.titulos
  }

  /** Correlativas como lista de aristas (para dibujar el árbol). */
  correlativas() {
    return this.def.correlativas
  }

  /** Correlativas anteriores directas (lo que necesitás antes). */
  antes(cod: string): string[] {
    return this.previas.get(cod) ?? []
  }

  /** Correlativas posteriores directas (lo que esta materia habilita). */
  despues(cod: string): string[] {
    return this.posteriores.get(cod) ?? []
  }

  /** ¿Es una optativa renombrable? */
  isOpt(cod: string): boolean {
    return this.porCod.get(cod)?.opt ?? false
  }

  /** ¿Se habilita por requisito especial (optativas, PPS, Proyecto Final)? */
  isSpecial(cod: string): boolean {
    return this.porCod.get(cod)?.porRequisito ?? false
  }

  /** Toda la cadena de prerrequisitos (ancestros recursivos): "necesitás". */
  chainUp(cod: string, acc = new Set<string>()): Set<string> {
    for (const p of this.antes(cod)) {
      if (!acc.has(p)) {
        acc.add(p)
        this.chainUp(p, acc)
      }
    }
    return acc
  }

  /** Toda la cadena de dependientes (descendientes recursivos): "habilita". */
  chainDown(cod: string, acc = new Set<string>()): Set<string> {
    for (const d of this.despues(cod)) {
      if (!acc.has(d)) {
        acc.add(d)
        this.chainDown(d, acc)
      }
    }
    return acc
  }

  /** Niveles (BFS) hacia arriba: 1 = previa directa, 2 = previa de la previa, etc. */
  chainUpLevels(cod: string): Map<string, number> {
    return this.bfsLevels(cod, (c) => this.antes(c))
  }

  /** Niveles (BFS) hacia abajo: 1 = habilita directo, 2 = el siguiente, etc. */
  chainDownLevels(cod: string): Map<string, number> {
    return this.bfsLevels(cod, (c) => this.despues(c))
  }

  private bfsLevels(cod: string, vecinos: (c: string) => string[]): Map<string, number> {
    const levels = new Map<string, number>()
    const visited = new Set<string>([cod])
    let frontier = [cod]
    let depth = 0
    while (frontier.length) {
      depth++
      const next: string[] = []
      for (const c of frontier) {
        for (const v of vecinos(c)) {
          if (!visited.has(v)) {
            visited.add(v)
            levels.set(v, depth) // BFS → primera vez = nivel más corto
            next.push(v)
          }
        }
      }
      frontier = next
    }
    return levels
  }

  /**
   * Agrupa las materias planas en la vista año → cuatrimestre → materias.
   * Los títulos cuelgan del año que cierran, o del cuatrimestre si el hito cae a mitad
   * de año (como el Técnico de la Lic. en IA).
   */
  private armarAnios(): Anio[] {
    const porAnio = new Map<number, Map<number, MateriaPlan[]>>()
    for (const m of this.def.materias) {
      if (!porAnio.has(m.anio)) porAnio.set(m.anio, new Map())
      const cuatris = porAnio.get(m.anio)!
      if (!cuatris.has(m.cuatri)) cuatris.set(m.cuatri, [])
      cuatris.get(m.cuatri)!.push(m)
    }
    return [...porAnio.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, cuatriMap]) => {
        const ns = [...cuatriMap.keys()].sort((a, b) => a - b)
        const ultimo = Math.max(...ns)
        // Un título "hasta el último cuatrimestre del año" es el año completo: cuelga
        // del año, no del cuatrimestre.
        const tituloDe = (cuatri?: number): string | undefined =>
          this.def.titulos.find((t) => {
            if (t.hastaAnio !== year) return false
            const corte = t.hastaCuatri != null && t.hastaCuatri < ultimo ? t.hastaCuatri : undefined
            return corte === cuatri
          })?.nombre
        return new Anio(
          year,
          ns.map((n) => new Cuatri(n, cuatriMap.get(n)!, tituloDe(n))),
          tituloDe(undefined),
        )
      })
  }
}

/** Instancia única del plan ACTIVO (elegido por el usuario; por defecto el de Ing.). */
export const plan = new Plan(getPlanDef(PlanActivo.id()))
