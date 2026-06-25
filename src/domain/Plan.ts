import { PLAN } from '../data/plan'
import { CORREL } from '../data/correlativas'
import type { AnioDef, MateriaDef } from '../types'

/** Materia del plan junto con dónde vive (año/cuatrimestre). */
export interface MateriaUbicada extends MateriaDef {
  year: number
  yi: number // índice de año (0-based)
  ci: number // índice de cuatrimestre (0-based)
}

/**
 * Grafo estático del plan de carrera: materias + correlativas.
 * No conoce el estado del usuario (eso vive en el Store); solo responde
 * preguntas sobre la estructura del plan.
 */
export class Plan {
  readonly anios: AnioDef[]
  private readonly correl: Record<string, string[]>

  constructor(anios: AnioDef[] = PLAN, correl: Record<string, string[]> = CORREL) {
    this.anios = anios
    this.correl = correl
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
    return this.materias().find((m) => m.cod === cod)?.nom ?? cod
  }

  /** Correlativas anteriores directas (lo que necesitás antes). */
  antes(cod: string): string[] {
    return this.correl[cod] ?? []
  }

  /** Correlativas posteriores directas (lo que esta materia habilita). */
  despues(cod: string): string[] {
    return Object.keys(this.correl).filter((k) => this.correl[k].includes(cod))
  }

  /** ¿Es una optativa renombrable (OPT1/2/3)? */
  isOpt(cod: string): boolean {
    return /^OPT\d/.test(cod)
  }

  /** ¿Se habilita por requisito especial (optativas, PPS, Proyecto Final)? */
  isSpecial(cod: string): boolean {
    return this.isOpt(cod) || /^PPS/.test(cod) || cod === '3.4.100'
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
}

/** Instancia única del plan (es estático). */
export const plan = new Plan()
