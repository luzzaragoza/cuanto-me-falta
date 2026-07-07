import type { AnioDef, MateriaDef } from '../types'
import type { Correlativa, MateriaPlan, PlanDef, TituloPlan } from '../data/model'
import { getPlanDef } from '../data/planes'
import { planActivoId } from '../state/planActivo'

/** Materia del plan junto con dónde vive (año/cuatrimestre). */
export interface MateriaUbicada extends MateriaDef {
  year: number
  yi: number // índice de año (0-based)
  ci: number // índice de cuatrimestre (0-based)
}

/** Agrupa las materias planas del PlanDef en la vista año → cuatrimestre → materias. */
function buildAnios(def: PlanDef): AnioDef[] {
  const porAnio = new Map<number, Map<number, MateriaDef[]>>()
  for (const m of def.materias) {
    if (!porAnio.has(m.anio)) porAnio.set(m.anio, new Map())
    const cuatris = porAnio.get(m.anio)!
    if (!cuatris.has(m.cuatri)) cuatris.set(m.cuatri, [])
    cuatris.get(m.cuatri)!.push({ cod: m.cod, nom: m.nom })
  }
  const tituloDe = (year: number) => def.titulos.find((t) => t.hastaAnio === year)?.nombre
  return [...porAnio.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, cuatriMap]) => ({
      year,
      titulo: tituloDe(year),
      cuatris: [...cuatriMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([n, mats]) => ({ n, mats })),
    }))
}

/** Lista de correlativas (aristas) → mapa `materia → [previas]`. */
function buildCorrel(def: PlanDef): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const c of def.correlativas) (out[c.cod] ??= []).push(c.requiere)
  return out
}

/**
 * Grafo estático de un plan de carrera: materias + correlativas + títulos.
 * Se construye desde un `PlanDef` (datos normalizados). No conoce el estado del
 * usuario (eso vive en el Store); solo responde preguntas sobre la estructura.
 */
export class Plan {
  readonly def: PlanDef
  readonly anios: AnioDef[]
  private readonly correl: Record<string, string[]>
  private readonly porCod: Map<string, MateriaPlan>

  constructor(def: PlanDef) {
    this.def = def
    this.anios = buildAnios(def)
    this.correl = buildCorrel(def)
    this.porCod = new Map(def.materias.map((m) => [m.cod, m]))
  }

  /** Nombre de la carrera (ej. 'Ingeniería en Informática'). */
  get carrera(): string {
    return this.def.carrera
  }

  /** Lista plana de todas las materias del plan, con su ubicación. */
  materias(): MateriaUbicada[] {
    const out: MateriaUbicada[] = []
    this.anios.forEach((a, yi) =>
      a.cuatris.forEach((q, ci) =>
        q.mats.forEach((m) => out.push({ ...m, year: a.year, yi, ci })),
      ),
    )
    return out
  }

  /** Nombre base de una materia por código (sin nombres custom de optativas). */
  nombre(cod: string): string {
    return this.porCod.get(cod)?.nom ?? cod
  }

  /** Títulos que otorga el plan (hitos). */
  titulos(): TituloPlan[] {
    return this.def.titulos
  }

  /** Correlativas como lista de aristas (para dibujar el árbol). */
  correlativas(): Correlativa[] {
    return this.def.correlativas
  }

  /** Correlativas anteriores directas (lo que necesitás antes). */
  antes(cod: string): string[] {
    return this.correl[cod] ?? []
  }

  /** Correlativas posteriores directas (lo que esta materia habilita). */
  despues(cod: string): string[] {
    return Object.keys(this.correl).filter((k) => this.correl[k].includes(cod))
  }

  /** ¿Es una optativa renombrable? */
  isOpt(cod: string): boolean {
    return this.porCod.get(cod)?.opt ?? false
  }

  /** ¿Se habilita por requisito especial (optativas, PPS, Proyecto Final)? */
  isSpecial(cod: string): boolean {
    const m = this.porCod.get(cod)
    return !!(m?.opt || m?.especial)
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
}

/** Instancia única del plan ACTIVO (elegido por el usuario; por defecto el de Ing.). */
export const plan = new Plan(getPlanDef(planActivoId()))
