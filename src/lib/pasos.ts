// En qué parte de la carga está el plan: los dos pasos, con dónde estás y qué falta.
//
// El editor tiene tres pestañas y no dice en cuál conviene estar. Para quien abre la
// pantalla por primera vez —el escenario del Gate C: alguien que no es Luz cargando una
// carrera con un manual— eso es justo lo que falta: no "qué botones hay", sino "qué
// tengo que hacer ahora y cuánto me falta".
//
// UNA REGLA QUE GOBIERNA TODO ESTE ARCHIVO: **ningún paso miente sobre estar completo.**
// Para las materias hay una verdad objetiva (están cargadas o no), pero para las
// correlativas NO existe: un plan puede tener pocas y estar perfecto, y las materias de
// primer año no tienen ninguna. Inventar un "✓ listo" ahí sería decirle a alguien que
// terminó cuando no sabemos. Por eso el paso 2 informa un CONTEO y no un porcentaje.

import type { Borrador } from './editorPlan'

/**
 * A dónde lleva cada paso.
 *
 * El tercero NO es una pestaña: "revisá y publicá" es el panel lateral, que se abre desde
 * cualquier parte del editor. Mandarlo a la pestaña Títulos —como hacía antes— dejaba a la
 * persona mirando los títulos sin entender por qué.
 */
export type DestinoPaso = 'estructura' | 'correlativas'

export type EstadoPaso =
  /** Todavía no se puede empezar (depende del anterior). */
  | 'pendiente'
  /** Se puede trabajar, y falta algo. */
  | 'enCurso'
  /** Hecho. */
  | 'listo'
  /** Hay errores que impiden avanzar. */
  | 'bloqueado'

export class Paso {
  readonly n: number
  readonly titulo: string
  /** Qué hay hecho, en números concretos. Nunca un porcentaje inventado. */
  readonly detalle: string
  readonly estado: EstadoPaso
  readonly destino: DestinoPaso

  constructor(campos: {
    n: number
    titulo: string
    detalle: string
    estado: EstadoPaso
    destino: DestinoPaso
  }) {
    this.n = campos.n
    this.titulo = campos.titulo
    this.detalle = campos.detalle
    this.estado = campos.estado
    this.destino = campos.destino
  }

  get hecho(): boolean {
    return this.estado === 'listo'
  }
}

export class Pasos {
  private readonly b: Borrador

  constructor(borrador: Borrador) {
    this.b = borrador
  }

  /**
   * Los pasos de la CARGA. Publicar no es uno.
   *
   * Fue el tercero por un rato y salió mal (feedback de Luz, 12-ago): brillaba como
   * "acá estás" mientras la persona seguía trabajando en la pestaña anterior, y abría un
   * panel encima de los otros dos pasos. Publicar no es una etapa por la que se avanza:
   * es algo que se hace cuando ya terminaste. Por eso volvió a ser un botón aparte.
   */
  get lista(): Paso[] {
    return [this.materias(), this.correlativas()]
  }

  /**
   * El paso en el que conviene estar: el primero que no está listo. Si están todos,
   * el último (no hay "cuarto paso").
   */
  get actual(): Paso {
    return this.lista.find((p) => !p.hecho) ?? this.lista[this.lista.length - 1]
  }

  // ── 1 · las materias ──
  private materias(): Paso {
    const conCodigo = this.b.materias.filter((m) => m.cod.trim() !== '')
    const aMedias = conCodigo.filter((m) => !m.guardable).length
    const anios = this.b.anios.length

    if (conCodigo.length === 0) {
      return new Paso({
        n: 1,
        titulo: 'Cargá las materias',
        detalle: 'Todavía no hay ninguna',
        estado: 'enCurso',
        destino: 'estructura',
      })
    }
    if (aMedias > 0) {
      return new Paso({
        n: 1,
        titulo: 'Cargá las materias',
        detalle: `${aMedias} ${aMedias === 1 ? 'quedó' : 'quedaron'} sin nombre`,
        estado: 'enCurso',
        destino: 'estructura',
      })
    }
    return new Paso({
      n: 1,
      titulo: 'Cargá las materias',
      detalle: `${conCodigo.length} en ${anios} ${anios === 1 ? 'año' : 'años'}`,
      estado: 'listo',
      destino: 'estructura',
    })
  }

  // ── 2 · las correlativas ──
  private correlativas(): Paso {
    const hayMaterias = this.b.materias.some((m) => m.cod.trim() !== '')
    if (!hayMaterias) {
      return new Paso({
        n: 2,
        titulo: 'Marcá qué necesita cada una',
        detalle: 'Después de cargar las materias',
        estado: 'pendiente',
        destino: 'correlativas',
      })
    }
    const n = this.b.correlativas.length
    // Cuántas materias tienen al menos una previa. NO es un porcentaje de avance: las de
    // primer año no tienen ninguna y están bien así.
    const conPrevias = new Set(this.b.correlativas.map((c) => c.cod)).size
    return new Paso({
      n: 2,
      titulo: 'Marcá qué necesita cada una',
      detalle:
        n === 0
          ? 'Todavía ninguna'
          : `${n} ${n === 1 ? 'correlativa' : 'correlativas'} · ${conPrevias} ${
              conPrevias === 1 ? 'materia tiene' : 'materias tienen'
            } previas`,
      estado: n === 0 ? 'enCurso' : 'listo',
      destino: 'correlativas',
    })
  }
}
