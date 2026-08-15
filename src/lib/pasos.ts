// En qué parte de la carga está el plan: los tres pasos, con dónde estás y qué falta.
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
import type { Validacion } from './validarPlan'

/** A qué pestaña del editor lleva cada paso. */
export type PestaniaPaso = 'estructura' | 'correlativas' | 'titulos'

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
  readonly pestania: PestaniaPaso

  constructor(campos: {
    n: number
    titulo: string
    detalle: string
    estado: EstadoPaso
    pestania: PestaniaPaso
  }) {
    this.n = campos.n
    this.titulo = campos.titulo
    this.detalle = campos.detalle
    this.estado = campos.estado
    this.pestania = campos.pestania
  }

  get hecho(): boolean {
    return this.estado === 'listo'
  }
}

export class Pasos {
  private readonly b: Borrador
  private readonly v: Validacion
  /** ¿Ya hay una versión publicada, y el borrador está igual? */
  private readonly sinCambiosPendientes: boolean

  constructor(borrador: Borrador, validacion: Validacion, sinCambiosPendientes = false) {
    this.b = borrador
    this.v = validacion
    this.sinCambiosPendientes = sinCambiosPendientes
  }

  get lista(): Paso[] {
    const uno = this.materias()
    return [uno, this.correlativas(), this.publicar(uno.hecho)]
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
        pestania: 'estructura',
      })
    }
    if (aMedias > 0) {
      return new Paso({
        n: 1,
        titulo: 'Cargá las materias',
        detalle: `${aMedias} ${aMedias === 1 ? 'quedó' : 'quedaron'} sin nombre`,
        estado: 'enCurso',
        pestania: 'estructura',
      })
    }
    return new Paso({
      n: 1,
      titulo: 'Cargá las materias',
      detalle: `${conCodigo.length} en ${anios} ${anios === 1 ? 'año' : 'años'}`,
      estado: 'listo',
      pestania: 'estructura',
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
        pestania: 'correlativas',
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
      pestania: 'correlativas',
    })
  }

  // ── 3 · revisar y publicar ──
  private publicar(materiasListas: boolean): Paso {
    // Un plan recién creado NO tiene errores: es que todavía no empezaste. El
    // validador dice "no tiene ninguna materia", que es cierto y es ruido — arrancar
    // con una alarma roja en el paso 3 desalienta y no informa nada que el paso 1 no
    // esté diciendo mejor.
    if (!materiasListas) {
      return new Paso({
        n: 3,
        titulo: 'Revisá y publicá',
        detalle: 'Cuando termines de cargar',
        estado: 'pendiente',
        pestania: 'titulos',
      })
    }
    const errores = this.v.errores.length
    if (errores > 0) {
      return new Paso({
        n: 3,
        titulo: 'Revisá y publicá',
        detalle: `${errores} ${errores === 1 ? 'error' : 'errores'} que hay que corregir`,
        estado: 'bloqueado',
        pestania: 'titulos',
      })
    }
    if (this.sinCambiosPendientes) {
      return new Paso({
        n: 3,
        titulo: 'Revisá y publicá',
        detalle: 'Los alumnos ya ven esta versión',
        estado: 'listo',
        pestania: 'titulos',
      })
    }
    const avisos = this.v.avisos.length
    return new Paso({
      n: 3,
      titulo: 'Revisá y publicá',
      detalle: avisos > 0 ? `Listo para publicar · ${avisos} aviso(s)` : 'Listo para publicar',
      estado: 'enCurso',
      pestania: 'titulos',
    })
  }
}
