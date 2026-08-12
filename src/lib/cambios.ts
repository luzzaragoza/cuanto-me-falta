// Qué cambió entre lo que ven los alumnos y lo que tenés en el borrador.
//
// No es un registro de clics: es una COMPARACIÓN entre la versión publicada (la foto de
// `plan_version`) y el borrador actual. Por eso sobrevive a cerrar la pestaña, no se
// desincroniza nunca, y es exactamente lo que hay que leer antes de publicar: "esto es lo
// que va a cambiar para los alumnos".
//
// Cada cambio sabe deshacerse solo (`deshacer`), y dice qué hay que guardar después —
// así la UI no tiene que adivinar qué escritura corresponde a cada caso.

import type { PlanDef, MateriaPlan } from '../data/model'
import type { Borrador, MateriaEdit } from './editorPlan'

export type TipoCambio =
  | 'sin-publicar'
  | 'cabecera'
  | 'materia-nueva'
  | 'materia-borrada'
  | 'materia-editada'
  | 'correlativa-nueva'
  | 'correlativa-borrada'
  | 'titulos'

export interface Cambio {
  /** Estable entre renders: sirve de key y de identidad para deshacer. */
  id: string
  tipo: TipoCambio
  /** Una línea, en el idioma del que carga el plan. */
  titulo: string
  /** El detalle de qué cambió exactamente (opcional). */
  detalle?: string
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
export function diffPlanes(publicado: PlanDef | null, borrador: PlanDef): Cambio[] {
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
  const dif: string[] = []
  if (publicado.carrera !== borrador.carrera) {
    dif.push(`nombre: "${publicado.carrera}" → "${borrador.carrera}"`)
  }
  if (publicado.codigo !== borrador.codigo) {
    dif.push(`código de plan: ${publicado.codigo} → ${borrador.codigo}`)
  }
  if (publicado.anio !== borrador.anio) dif.push(`año: ${publicado.anio} → ${borrador.anio}`)
  if (dif.length) {
    cambios.push({
      id: 'cabecera',
      tipo: 'cabecera',
      titulo: 'Cambiaron los datos de la carrera',
      detalle: dif.join(' · '),
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
        titulo: `Materia nueva: ${m.nom}`,
        detalle: `${m.cod} · ${ubic(m)}`,
        cods: [m.cod],
        reversible: true,
      })
      continue
    }
    const d: string[] = []
    if (antes.nom !== m.nom) d.push(`nombre: "${antes.nom}" → "${m.nom}"`)
    if (antes.anio !== m.anio || antes.cuatri !== m.cuatri) {
      d.push(`movida de ${ubic(antes)} a ${ubic(m)}`)
    }
    if (!!antes.opt !== !!m.opt) d.push(m.opt ? 'ahora es optativa' : 'ya no es optativa')
    if (!!antes.especial !== !!m.especial) {
      d.push(m.especial ? 'ahora es especial' : 'ya no es especial')
    }
    if (d.length) {
      cambios.push({
        id: `mat-edit-${m.cod}`,
        tipo: 'materia-editada',
        titulo: `Cambió ${antes.nom}`,
        detalle: d.join(' · '),
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
        titulo: `Materia borrada: ${m.nom}`,
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
        titulo: `Correlativa nueva: ${nombreEn(borrador, c.cod)} necesita ${nombreEn(borrador, c.requiere)}`,
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
        titulo: `Correlativa quitada: ${nombreEn(publicado, c.cod)} ya no necesita ${nombreEn(publicado, c.requiere)}`,
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
      titulo: 'Cambiaron los títulos',
      detalle: `${publicado.titulos.length} → ${borrador.titulos.length}: ${
        borrador.titulos.map((t) => t.nombre).join(', ') || 'ninguno'
      }`,
      cods: [],
      reversible: true,
    })
  }

  return cambios
}

/** ¿Hay algo que publicar? */
export function hayCambios(publicado: PlanDef | null, borrador: PlanDef): boolean {
  return diffPlanes(publicado, borrador).some((c) => c.reversible)
}

/**
 * Convierte una materia publicada en una fila editable (para restaurar una borrada).
 * A propósito SIN `codOriginal`: esa marca hace que el guardado haga UPDATE sobre el
 * código viejo, y acá la fila ya no existe en la base — hay que insertarla. Con
 * `codOriginal` undefined, el guardado hace upsert y la materia vuelve de verdad.
 */
function aFila(m: MateriaPlan, orden: number): MateriaEdit {
  return {
    cod: m.cod,
    nom: m.nom,
    anio: m.anio,
    cuatri: m.cuatri,
    opt: m.opt === true,
    especial: m.especial === true,
    orden,
  }
}

/**
 * Deshace UN cambio: devuelve el borrador como quedaría y qué hay que guardar.
 * Si el cambio no se puede deshacer, devuelve el borrador igual y `guardar: null`.
 */
export function deshacerCambio(
  borrador: Borrador,
  publicado: PlanDef,
  cambio: Cambio,
): { borrador: Borrador; guardar: Guardado | null } {
  const sinTocar = { borrador, guardar: null }
  const cod = cambio.cods[0]

  switch (cambio.tipo) {
    case 'cabecera':
      return {
        borrador: {
          ...borrador,
          carrera: publicado.carrera,
          codigo: publicado.codigo,
          anio: publicado.anio,
        },
        guardar: { que: 'cabecera' },
      }

    case 'materia-nueva': {
      // se va la materia y, con ella, las correlativas que la mencionaban
      return {
        borrador: {
          ...borrador,
          materias: borrador.materias.filter((m) => m.cod !== cod),
          correlativas: borrador.correlativas.filter(
            (c) => c.cod !== cod && c.requiere !== cod,
          ),
        },
        guardar: { que: 'materia-borrar', cod },
      }
    }

    case 'materia-borrada': {
      const orig = publicado.materias.find((m) => m.cod === cod)
      if (!orig) return sinTocar
      const orden = borrador.materias.reduce((max, m) => Math.max(max, m.orden), -1) + 1
      return {
        borrador: { ...borrador, materias: [...borrador.materias, aFila(orig, orden)] },
        guardar: { que: 'materia', cod },
      }
    }

    case 'materia-editada': {
      const orig = publicado.materias.find((m) => m.cod === cod)
      if (!orig) return sinTocar
      return {
        borrador: {
          ...borrador,
          materias: borrador.materias.map((m) =>
            m.cod === cod
              ? {
                  ...m,
                  nom: orig.nom,
                  anio: orig.anio,
                  cuatri: orig.cuatri,
                  opt: orig.opt === true,
                  especial: orig.especial === true,
                }
              : m,
          ),
        },
        guardar: { que: 'materia', cod },
      }
    }

    case 'correlativa-nueva': {
      const [c1, c2] = cambio.cods
      return {
        borrador: {
          ...borrador,
          correlativas: borrador.correlativas.filter(
            (c) => !(c.cod === c1 && c.requiere === c2),
          ),
        },
        guardar: { que: 'previas', cod: c1 },
      }
    }

    case 'correlativa-borrada': {
      const [c1, c2] = cambio.cods
      const existe = borrador.correlativas.some((c) => c.cod === c1 && c.requiere === c2)
      return {
        borrador: existe
          ? borrador
          : { ...borrador, correlativas: [...borrador.correlativas, { cod: c1, requiere: c2 }] },
        guardar: { que: 'previas', cod: c1 },
      }
    }

    case 'titulos':
      return {
        borrador: { ...borrador, titulos: publicado.titulos.map((t) => ({ ...t })) },
        guardar: { que: 'titulos' },
      }

    default:
      return sinTocar
  }
}
