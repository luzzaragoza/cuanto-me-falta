// Qué cambió entre lo que ven los alumnos y lo que tenés en el borrador.
//
// No es un registro de clics: es una COMPARACIÓN entre la versión publicada (la foto de
// `plan_version`) y el borrador actual. Por eso sobrevive a cerrar la pestaña, no se
// desincroniza nunca, y es exactamente lo que hay que leer antes de publicar: "esto es lo
// que va a cambiar para los alumnos".
//
// Cada cambio sabe deshacerse solo (`deshacer`), y dice qué hay que guardar después —
// así la UI no tiene que adivinar qué escritura corresponde a cada caso.

import { Correlativa, type PlanDef, type MateriaPlan } from '../data/model'
import { MateriaEdit, type Borrador } from './editorPlan'

export type TipoCambio =
  | 'sin-publicar'
  | 'cabecera'
  | 'materia-nueva'
  | 'materia-borrada'
  | 'materia-editada'
  | 'correlativa-nueva'
  | 'correlativa-borrada'
  | 'titulos'

/**
 * Un campo que cambió, con sus dos valores.
 *
 * Va estructurado y no como texto armado ("nombre: X → Y") porque la pantalla los
 * muestra como un antes/después de verdad, con los dos valores enfrentados. Cuando el
 * detalle era un string, la UI habría tenido que parsearlo para pintarlo.
 */
export interface Parte {
  campo: string
  antes: string
  despues: string
}

export interface Cambio {
  /** Estable entre renders: sirve de key y de identidad para deshacer. */
  id: string
  tipo: TipoCambio
  /** Una línea, en el idioma del que carga el plan. */
  titulo: string
  /** El detalle de qué cambió exactamente (opcional). */
  detalle?: string
  /** Los campos que cambiaron, con su valor anterior y el nuevo. */
  partes?: Parte[]
  /** Materias involucradas, para poder resaltarlas. */
  cods: string[]
  /** `false` cuando no hay nada que revertir (p. ej. un plan que nunca se publicó). */
  reversible: boolean
}

/** Qué escritura hay que hacer después de deshacer un cambio. */
export type Guardado =
  | { que: 'materia'; cod: string }
  | { que: 'materia-borrar'; cod: string }
  | { que: 'previas'; cod: string }
  | { que: 'titulos' }
  | { que: 'cabecera' }

const nombreEn = (p: PlanDef | null, cod: string): string =>
  p?.materias.find((m) => m.cod === cod)?.nom ?? cod

const ubic = (m: { anio: number; cuatri: number }): string => `${m.anio}° año · ${m.cuatri}° cuatri`

/**
 * Compara la versión publicada contra el borrador. Devuelve los cambios en orden de
 * lectura: primero la cabecera, después materias, correlativas y títulos.
 */
function calcularCambios(publicado: PlanDef | null, borrador: PlanDef): Cambio[] {
  if (!publicado) {
    return [
      {
        id: 'sin-publicar',
        tipo: 'sin-publicar',
        titulo: 'Este plan todavía no se publicó',
        detalle: `Los alumnos no lo ven. Tenés ${borrador.materias.length} materias y ${borrador.correlativas.length} correlativas listas para publicar.`,
        cods: [],
        reversible: false,
      },
    ]
  }

  const cambios: Cambio[] = []

  // ── cabecera ──
  const dif: Parte[] = []
  if (publicado.carrera !== borrador.carrera) {
    dif.push({ campo: 'nombre', antes: publicado.carrera, despues: borrador.carrera })
  }
  if (publicado.codigo !== borrador.codigo) {
    dif.push({ campo: 'código de plan', antes: publicado.codigo, despues: borrador.codigo })
  }
  if (publicado.anio !== borrador.anio) {
    dif.push({ campo: 'año', antes: String(publicado.anio), despues: String(borrador.anio) })
  }
  if (dif.length) {
    cambios.push({
      id: 'cabecera',
      tipo: 'cabecera',
      // sin título: el encabezado del grupo dice el TIPO y el título dice CUÁL, y acá
      // no hay "cuál" — el que cambió es el plan mismo. Lo dicen las partes.
      titulo: '',
      partes: dif,
      cods: [],
      reversible: true,
    })
  }

  // ── materias ──
  const pubM = new Map(publicado.materias.map((m) => [m.cod, m]))
  const borM = new Map(borrador.materias.map((m) => [m.cod, m]))

  for (const m of borrador.materias) {
    const antes = pubM.get(m.cod)
    if (!antes) {
      cambios.push({
        id: `mat-nueva-${m.cod}`,
        tipo: 'materia-nueva',
        titulo: m.nom,
        detalle: `${m.cod} · ${ubic(m)}`,
        cods: [m.cod],
        reversible: true,
      })
      continue
    }
    const d: Parte[] = []
    if (antes.nom !== m.nom) d.push({ campo: 'nombre', antes: antes.nom, despues: m.nom })
    if (antes.anio !== m.anio || antes.cuatri !== m.cuatri) {
      d.push({ campo: 'ubicación', antes: ubic(antes), despues: ubic(m) })
    }
    if (!!antes.opt !== !!m.opt) {
      d.push({ campo: 'optativa', antes: antes.opt ? 'sí' : 'no', despues: m.opt ? 'sí' : 'no' })
    }
    if (!!antes.especial !== !!m.especial) {
      d.push({
        campo: 'especial',
        antes: antes.especial ? 'sí' : 'no',
        despues: m.especial ? 'sí' : 'no',
      })
    }
    if (d.length) {
      cambios.push({
        id: `mat-edit-${m.cod}`,
        tipo: 'materia-editada',
        titulo: antes.nom,
        partes: d,
        cods: [m.cod],
        reversible: true,
      })
    }
  }

  for (const m of publicado.materias) {
    if (!borM.has(m.cod)) {
      cambios.push({
        id: `mat-borrada-${m.cod}`,
        tipo: 'materia-borrada',
        titulo: m.nom,
        detalle: `${m.cod} · ${ubic(m)}`,
        cods: [m.cod],
        reversible: true,
      })
    }
  }

  // ── correlativas ──
  const clave = (c: { cod: string; requiere: string }): string => `${c.cod}<-${c.requiere}`
  const pubC = new Set(publicado.correlativas.map(clave))
  const borC = new Set(borrador.correlativas.map(clave))

  for (const c of borrador.correlativas) {
    if (!pubC.has(clave(c))) {
      cambios.push({
        id: `corr-nueva-${clave(c)}`,
        tipo: 'correlativa-nueva',
        titulo: `${nombreEn(borrador, c.cod)} necesita ${nombreEn(borrador, c.requiere)}`,
        cods: [c.cod, c.requiere],
        reversible: true,
      })
    }
  }
  for (const c of publicado.correlativas) {
    if (!borC.has(clave(c))) {
      cambios.push({
        id: `corr-borrada-${clave(c)}`,
        tipo: 'correlativa-borrada',
        titulo: `${nombreEn(publicado, c.cod)} ya no necesita ${nombreEn(publicado, c.requiere)}`,
        cods: [c.cod, c.requiere],
        reversible: true,
      })
    }
  }

  // ── títulos (son pocos: se comparan como bloque) ──
  const serie = (p: PlanDef): string => JSON.stringify(p.titulos)
  if (serie(publicado) !== serie(borrador)) {
    cambios.push({
      id: 'titulos',
      tipo: 'titulos',
      titulo: '',
      detalle: `${publicado.titulos.length} → ${borrador.titulos.length}: ${
        borrador.titulos.map((t) => t.nombre).join(', ') || 'ninguno'
      }`,
      cods: [],
      reversible: true,
    })
  }

  return cambios
}

/**
 * Convierte una materia publicada en una fila editable (para restaurar una borrada).
 * A propósito SIN `codOriginal`: esa marca hace que el guardado haga UPDATE sobre el
 * código viejo, y acá la fila ya no existe en la base — hay que insertarla. Con
 * `codOriginal` undefined, el guardado hace upsert y la materia vuelve de verdad.
 */
function aFila(m: MateriaPlan, orden: number): MateriaEdit {
  return new MateriaEdit({
    cod: m.cod,
    nom: m.nom,
    anio: m.anio,
    cuatri: m.cuatri,
    opt: m.opt,
    especial: m.especial,
    orden,
  })
}

/**
 * Deshace UN cambio: devuelve el borrador como quedaría y qué hay que guardar.
 * Si el cambio no se puede deshacer, devuelve el borrador igual y `guardar: null`.
 */
function revertir(
  borrador: Borrador,
  publicado: PlanDef,
  cambio: Cambio,
): { borrador: Borrador; guardar: Guardado | null } {
  const sinTocar = { borrador, guardar: null }
  const cod = cambio.cods[0]

  switch (cambio.tipo) {
    case 'cabecera':
      return {
        borrador: borrador.conCabecera({
          carrera: publicado.carrera,
          codigo: publicado.codigo,
          anio: publicado.anio,
        }),
        guardar: { que: 'cabecera' },
      }

    case 'materia-nueva': {
      // se va la materia y, con ella, las correlativas que la mencionaban
      return {
        borrador: borrador
          .conMaterias(borrador.materias.filter((m) => m.cod !== cod))
          .conCorrelativas(borrador.correlativas.filter((c) => !c.toca(cod))),
        guardar: { que: 'materia-borrar', cod },
      }
    }

    case 'materia-borrada': {
      const orig = publicado.materias.find((m) => m.cod === cod)
      if (!orig) return sinTocar
      const orden = borrador.materias.reduce((max, m) => Math.max(max, m.orden), -1) + 1
      return {
        borrador: borrador.conMaterias([...borrador.materias, aFila(orig, orden)]),
        guardar: { que: 'materia', cod },
      }
    }

    case 'materia-editada': {
      const orig = publicado.materias.find((m) => m.cod === cod)
      if (!orig) return sinTocar
      return {
        borrador: borrador.conMaterias(
          borrador.materias.map((m) =>
            m.cod === cod
              ? m.con({
                  nom: orig.nom,
                  anio: orig.anio,
                  cuatri: orig.cuatri,
                  opt: orig.opt,
                  especial: orig.especial,
                })
              : m,
          ),
        ),
        guardar: { que: 'materia', cod },
      }
    }

    case 'correlativa-nueva': {
      const [c1, c2] = cambio.cods
      return {
        borrador: borrador.conCorrelativas(
          borrador.correlativas.filter((c) => !(c.cod === c1 && c.requiere === c2)),
        ),
        guardar: { que: 'previas', cod: c1 },
      }
    }

    case 'correlativa-borrada': {
      const [c1, c2] = cambio.cods
      const existe = borrador.correlativas.some((c) => c.cod === c1 && c.requiere === c2)
      return {
        borrador: existe
          ? borrador
          : borrador.conCorrelativas([...borrador.correlativas, new Correlativa(c1, c2)]),
        guardar: { que: 'previas', cod: c1 },
      }
    }

    case 'titulos':
      return {
        // los títulos son inmutables: alcanza con copiar el array, no hace falta clonar
        borrador: borrador.conTitulos([...publicado.titulos]),
        guardar: { que: 'titulos' },
      }

    default:
      return sinTocar
  }
}


/** El encabezado de cada grupo, con el conteo y el plural bien puesto. */
function etiquetaDe(tipo: TipoCambio, n: number): string {
  const uno = n === 1
  switch (tipo) {
    case 'sin-publicar':
      return 'Todavía sin publicar'
    case 'cabecera':
      return 'Datos de la carrera'
    case 'materia-nueva':
      return uno ? '1 materia nueva' : `${n} materias nuevas`
    case 'materia-editada':
      return uno ? '1 materia modificada' : `${n} materias modificadas`
    case 'materia-borrada':
      return uno ? '1 materia borrada' : `${n} materias borradas`
    case 'correlativa-nueva':
      return uno ? '1 correlativa nueva' : `${n} correlativas nuevas`
    case 'correlativa-borrada':
      return uno ? '1 correlativa quitada' : `${n} correlativas quitadas`
    case 'titulos':
      return 'Títulos'
  }
}

/**
 * La comparación entre lo que ven los alumnos y lo que el admin tiene a medio editar.
 *
 * No es un registro de acciones: es una COMPARACIÓN contra la foto publicada. Por eso
 * sobrevive a recargar la página y es literalmente "esto es lo que va a cambiar para los
 * alumnos", en vez de "esto es lo que toqué desde que abrí la pantalla".
 *
 * Sostiene los dos lados —la foto y el borrador editable— para que quien la use no tenga
 * que acordarse de pasarlos en el orden correcto en cada llamada.
 */
export class Diff {
  private readonly publicado: PlanDef | null
  private readonly borrador: Borrador
  private cache?: Cambio[]

  constructor(publicado: PlanDef | null, borrador: Borrador) {
    this.publicado = publicado
    this.borrador = borrador
  }

  /** Los cambios, en orden de lectura. Se calcula una vez por instancia. */
  get cambios(): Cambio[] {
    this.cache ??= calcularCambios(this.publicado, this.borrador.aPlan())
    return this.cache
  }

  /**
   * Los cambios agrupados por tipo, en orden de lectura y con su conteo.
   *
   * Una lista plana de 30 líneas no se lee: agrupada, se escanea. "5 materias nuevas"
   * antes que cinco renglones sueltos que hay que contar con el dedo.
   */
  get grupos(): Array<{ tipo: TipoCambio; etiqueta: string; cambios: Cambio[] }> {
    const orden: TipoCambio[] = [
      'sin-publicar',
      'cabecera',
      'materia-nueva',
      'materia-editada',
      'materia-borrada',
      'correlativa-nueva',
      'correlativa-borrada',
      'titulos',
    ]
    return orden
      .map((tipo) => ({
        tipo,
        etiqueta: etiquetaDe(tipo, this.cambios.filter((c) => c.tipo === tipo).length),
        cambios: this.cambios.filter((c) => c.tipo === tipo),
      }))
      .filter((g) => g.cambios.length > 0)
  }

  /** Solo los que se pueden deshacer de a uno (el aviso "sin publicar" no cuenta). */
  get reversibles(): Cambio[] {
    return this.cambios.filter((c) => c.reversible)
  }

  /** ¿Hay algo que publicar? */
  get hay(): boolean {
    return this.reversibles.length > 0
  }

  get cuantos(): number {
    return this.reversibles.length
  }

  /**
   * Deshace UN cambio: devuelve el borrador como quedaría y qué escritura corresponde.
   * Devolver el `guardar` es a propósito — así la UI no tiene que adivinar si lo que
   * cambió fue una materia, sus previas o los títulos.
   */
  deshacer(cambio: Cambio): { borrador: Borrador; guardar: Guardado | null } {
    if (!this.publicado) return { borrador: this.borrador, guardar: null }
    return revertir(this.borrador, this.publicado, cambio)
  }
}
