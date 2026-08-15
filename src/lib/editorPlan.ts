// El borrador de un plan mientras se edita.
//
// La UI tiene un `Borrador` en memoria y lo transforma llamando a sus métodos; el
// guardado va aparte (`state/admin.ts`), acción por acción, para no mandar el plan
// entero en cada tecla.
//
// **Todo acá es inmutable**: cada método devuelve un `Borrador` nuevo. Así se testea sin
// backend y la UI no tiene lógica de dominio escondida entre los componentes.
//
// POR QUÉ ES UNA CLASE Y NO UN PUÑADO DE FUNCIONES: hay una invariante que sostener —
// *toda correlativa apunta a materias que existen en el borrador* — y antes vivía
// repartida en tres lugares que había que acordarse de llamar: `quitarMateria` la
// limpiaba en los dos sentidos, `renombrarCodigo` arrastraba el grafo, y `aPlanDef`
// filtraba las colgadas. Nada impedía agregar una función número diecisiete que se
// olvidara de alguna. Ahora el único camino para construir el borrador siguiente pasa
// por acá adentro.
//
// `aPlan()` es la bisagra: con ella el mismo borrador alimenta al validador Y al árbol
// de correlativas, sin código nuevo.

import { Correlativa, MateriaPlan, PlanDef, type TituloPlan } from '../data/model'

/** Una materia en edición: la del plan, más lo que hace falta para editarla. */
export class MateriaEdit {
  readonly cod: string
  readonly nom: string
  readonly anio: number
  readonly cuatri: number
  readonly opt: boolean
  readonly especial: boolean
  /** Identidad estable de la fila: no cambia aunque se corrija el código. */
  readonly orden: number
  /** Todavía no existe en la base. */
  readonly nueva: boolean
  /** Código con el que está guardada en la base (para poder renombrar el código). */
  readonly codOriginal?: string

  constructor(campos: {
    cod: string
    nom: string
    anio: number
    cuatri: number
    opt?: boolean
    especial?: boolean
    orden: number
    nueva?: boolean
    codOriginal?: string
  }) {
    this.cod = campos.cod
    this.nom = campos.nom
    this.anio = campos.anio
    this.cuatri = campos.cuatri
    this.opt = campos.opt ?? false
    this.especial = campos.especial ?? false
    this.orden = campos.orden
    this.nueva = campos.nueva ?? false
    this.codOriginal = campos.codOriginal
  }

  /** Copia con algunos campos cambiados. Reemplaza al viejo `{ ...m, campo: x }`. */
  con(campos: Partial<Omit<ConstructorParameters<typeof MateriaEdit>[0], 'orden'>>): MateriaEdit {
    return new MateriaEdit({
      cod: this.cod,
      nom: this.nom,
      anio: this.anio,
      cuatri: this.cuatri,
      opt: this.opt,
      especial: this.especial,
      nueva: this.nueva,
      codOriginal: this.codOriginal,
      ...campos,
      orden: this.orden,
    })
  }

  get codLimpio(): string {
    return this.cod.trim()
  }

  /** Posición temporal, con la misma fórmula que usa el plan publicado. */
  get indice(): number {
    return MateriaPlan.indiceDe(this.anio, this.cuatri)
  }

  /** ¿Tiene lo mínimo para poder guardarse? */
  get guardable(): boolean {
    return this.codLimpio !== '' && this.nom.trim() !== ''
  }

  /** Una fila recién agregada, sin código todavía, no es parte del plan aún. */
  get cargada(): boolean {
    return this.codLimpio !== ''
  }

  aMateriaPlan(): MateriaPlan {
    return new MateriaPlan(
      this.codLimpio,
      this.nom.trim(),
      this.anio,
      this.cuatri,
      this.opt,
      this.especial,
    )
  }
}

/** Qué correlativas rompería un movimiento (para avisar ANTES de guardar). */
export interface Movimiento {
  borrador: Borrador
  rotas: Correlativa[]
}

export class Borrador {
  readonly id: string
  readonly universidad: string
  readonly codigo: string
  readonly anio: number
  readonly carrera: string
  readonly materias: readonly MateriaEdit[]
  readonly correlativas: readonly Correlativa[]
  readonly titulos: readonly TituloPlan[]

  constructor(campos: {
    id: string
    universidad: string
    codigo: string
    anio: number
    carrera: string
    materias: readonly MateriaEdit[]
    correlativas: readonly Correlativa[]
    titulos: readonly TituloPlan[]
  }) {
    this.id = campos.id
    this.universidad = campos.universidad
    this.codigo = campos.codigo
    this.anio = campos.anio
    this.carrera = campos.carrera
    this.materias = campos.materias
    this.correlativas = campos.correlativas
    this.titulos = campos.titulos
  }

  /** Copia con algunas partes cambiadas. Privada: el camino son los métodos de abajo. */
  private con(campos: {
    codigo?: string
    anio?: number
    carrera?: string
    materias?: readonly MateriaEdit[]
    correlativas?: readonly Correlativa[]
    titulos?: readonly TituloPlan[]
  }): Borrador {
    return new Borrador({
      id: this.id,
      universidad: this.universidad,
      codigo: campos.codigo ?? this.codigo,
      anio: campos.anio ?? this.anio,
      carrera: campos.carrera ?? this.carrera,
      materias: campos.materias ?? this.materias,
      correlativas: campos.correlativas ?? this.correlativas,
      titulos: campos.titulos ?? this.titulos,
    })
  }

  // ── consultas ───────────────────────────────────────────────────────────

  /** Orden de lectura: por año, cuatrimestre y el orden dentro del cuatrimestre. */
  get ordenadas(): MateriaEdit[] {
    return [...this.materias].sort(
      (a, b) =>
        a.anio - b.anio || a.cuatri - b.cuatri || a.orden - b.orden || a.cod.localeCompare(b.cod),
    )
  }

  materiaEn(orden: number): MateriaEdit | undefined {
    return this.materias.find((m) => m.orden === orden)
  }

  /** Años que el plan tiene con materias, en orden. */
  get anios(): number[] {
    return [...new Set(this.materias.map((m) => m.anio))].sort((a, z) => a - z)
  }

  /** Cuenta lo que hay, para el encabezado del editor. */
  get resumen(): { materias: number; correlativas: number; titulos: number } {
    return {
      materias: this.materias.filter((m) => m.cargada).length,
      correlativas: this.correlativas.length,
      titulos: this.titulos.length,
    }
  }

  /**
   * El borrador como `PlanDef`: lo que come el validador y el árbol.
   *
   * Las materias sin código quedan afuera (son filas recién agregadas que todavía no se
   * pueden guardar) y con ellas sus correlativas, para no inventar referencias colgadas.
   * Por eso el plan sigue siendo publicable mientras alguien está tipeando una fila.
   */
  aPlan(): PlanDef {
    const materias = this.ordenadas.filter((m) => m.cargada).map((m) => m.aMateriaPlan())
    const existentes = new Set(materias.map((m) => m.cod))
    return new PlanDef(
      this.id,
      this.universidad,
      this.codigo,
      this.anio,
      this.carrera,
      materias,
      this.correlativas.filter((c) => existentes.has(c.cod) && existentes.has(c.requiere)),
      [...this.titulos],
    )
  }

  /** Materias que PUEDEN ser previa de `cod`: cuatrimestre anterior y no optativas. */
  elegiblesComoPrevia(cod: string): MateriaEdit[] {
    const yo = this.materias.find((m) => m.cod === cod)
    if (!yo) return []
    return this.ordenadas.filter(
      (m) => m.cod !== cod && m.cargada && !m.opt && m.indice < yo.indice,
    )
  }

  /**
   * Materias que pueden tener a `cod` COMO previa: cuatrimestre posterior y no optativas.
   * Es la dirección inversa, y existe porque cargar un plan se lee en los dos sentidos:
   * "esta necesita…" o "esta habilita…".
   */
  elegiblesComoPosterior(cod: string): MateriaEdit[] {
    const yo = this.materias.find((m) => m.cod === cod)
    if (!yo || yo.opt) return [] // una optativa no habilita nada (RN-05)
    return this.ordenadas.filter(
      (m) => m.cod !== cod && m.cargada && !m.opt && m.indice > yo.indice,
    )
  }

  /** Códigos que `cod` requiere hoy. */
  previasDe(cod: string): string[] {
    return this.correlativas.filter((c) => c.cod === cod).map((c) => c.requiere)
  }

  /** Materias que se habilitan con `cod` (para avisar antes de borrarla). */
  dependenDe(cod: string): string[] {
    return this.correlativas.filter((c) => c.requiere === cod).map((c) => c.cod)
  }

  /** ¿Ya existe ese código en el plan? (ignorando a la propia materia) */
  codigoRepetido(cod: string, exceptoOrden: number): boolean {
    const limpio = cod.trim()
    if (!limpio) return false
    return this.materias.some((m) => m.orden !== exceptoOrden && m.codLimpio === limpio)
  }

  // ── transiciones ────────────────────────────────────────────────────────

  /** Pone o saca una previa. No valida: las elegibles ya vienen filtradas. */
  alternarPrevia(cod: string, requiere: string): Borrador {
    const existe = this.correlativas.some((c) => c.cod === cod && c.requiere === requiere)
    return this.con({
      correlativas: existe
        ? this.correlativas.filter((c) => !(c.cod === cod && c.requiere === requiere))
        : [...this.correlativas, new Correlativa(cod, requiere)],
    })
  }

  /** Agrega una fila vacía al final de ese cuatrimestre. Devuelve el borrador y su `orden`. */
  agregarMateria(anio: number, cuatri: number): { borrador: Borrador; orden: number } {
    const orden = this.materias.reduce((max, m) => Math.max(max, m.orden), -1) + 1
    const nueva = new MateriaEdit({ cod: '', nom: '', anio, cuatri, orden, nueva: true })
    return { borrador: this.con({ materias: [...this.materias, nueva] }), orden }
  }

  /** Cambia campos de una materia, identificada por su `orden`. */
  editarMateria(
    orden: number,
    campos: Partial<Omit<ConstructorParameters<typeof MateriaEdit>[0], 'orden'>>,
  ): Borrador {
    return this.con({
      materias: this.materias.map((m) => (m.orden === orden ? m.con(campos) : m)),
    })
  }

  /**
   * Saca una materia y TODAS sus correlativas, en los dos sentidos. Sin esto quedarían
   * referencias a un código que ya no existe — que es justo lo que el validador rechaza.
   */
  quitarMateria(orden: number): Borrador {
    const m = this.materiaEn(orden)
    if (!m) return this
    const cod = m.codLimpio
    return this.con({
      materias: this.materias.filter((x) => x.orden !== orden),
      correlativas: cod ? this.correlativas.filter((c) => !c.toca(cod)) : this.correlativas,
    })
  }

  /**
   * Renombrar el CÓDIGO de una materia arrastra sus correlativas: si no, corregir un
   * código mal tipeado dejaría el grafo apuntando al viejo. (La base hace lo mismo con
   * el `on update cascade` de la migración 005.)
   */
  renombrarCodigo(orden: number, nuevo: string): Borrador {
    const m = this.materiaEn(orden)
    if (!m) return this
    const viejo = m.codLimpio
    const limpio = nuevo.trim()
    const conCodigo = this.editarMateria(orden, { cod: nuevo })
    if (!viejo || !limpio || viejo === limpio) return conCodigo
    return conCodigo.con({
      correlativas: conCodigo.correlativas.map(
        (c) =>
          new Correlativa(
            c.cod === viejo ? limpio : c.cod,
            c.requiere === viejo ? limpio : c.requiere,
          ),
      ),
    })
  }

  /**
   * Mover una materia a otro cuatrimestre puede volver imposibles algunas correlativas
   * (una previa que ahora queda en el mismo cuatrimestre o después). Devuelve el
   * borrador movido Y las correlativas que quedaron mal, para avisar ANTES de guardar.
   */
  moverMateria(orden: number, anio: number, cuatri: number): Movimiento {
    const borrador = this.editarMateria(orden, { anio, cuatri })
    const idx = new Map(
      borrador.materias.filter((m) => m.cargada).map((m) => [m.codLimpio, m.indice]),
    )
    const rotas = borrador.correlativas.filter((c) => {
      const a = idx.get(c.cod)
      const r = idx.get(c.requiere)
      return a !== undefined && r !== undefined && r >= a
    })
    return { borrador, rotas }
  }

  conTitulos(titulos: readonly TituloPlan[]): Borrador {
    return this.con({ titulos })
  }

  conCabecera(datos: { codigo: string; anio: number; carrera: string }): Borrador {
    return this.con(datos)
  }

  conCorrelativas(correlativas: readonly Correlativa[]): Borrador {
    return this.con({ correlativas })
  }

  conMaterias(materias: readonly MateriaEdit[]): Borrador {
    return this.con({ materias })
  }
}
