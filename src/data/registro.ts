// Registro de datos académicos: de dónde salen los planes que ve la app.
//
// ESTRATEGIA: snapshot + refresco (ADR-11).
//
//   1. Los planes del repo viajan en el bundle y son el PISO. La app abre sin red,
//      sin sesión y sin backend configurado — como siempre.
//   2. Si hay un caché en localStorage (bajado del backend en una visita anterior),
//      ese gana: se lee de forma SÍNCRONA al importar el módulo, así nadie tiene que
//      esperar nada y los 8 lugares que hacen `import { PLANES }` no cambian.
//   3. El refresco contra el backend corre DESPUÉS, en segundo plano
//      (`src/state/planesRemoto.ts`), y solo escribe el caché: no reemplaza los planes
//      en caliente. Un plan que cambia debajo de un usuario a mitad de sesión es peor
//      que esperar a que vuelva a abrir la app — y esto cambia dos veces al año.
//
// Descartado: hacer el fetch bloqueante al arrancar. Le agrega latencia al 100% de las
// visitas (y rompe el offline de la PWA) por un dato que casi nunca cambia.
//
// Este módulo es PURO en el sentido del repo: no conoce Supabase ni la red. Solo
// localStorage (guardado) y el validador. La parte de I/O vive en `state/planesRemoto`.

import type { PlanDef, Universidad } from './model'
import { esPublicable, erroresDe } from '../lib/validarPlan'

const CACHE_KEY = 'cmf-planes-cache'
/** Subir esto invalida los cachés viejos de todos los dispositivos. */
const CACHE_VERSION = 1

export interface Registro {
  universidades: Universidad[]
  planes: PlanDef[]
}

interface CacheGuardado extends Registro {
  v: number
  at: string
}

function tieneStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

/**
 * Descarta lo que no se puede dibujar: planes que no pasan el validador y
 * universidades sin id. Un plan roto en el caché o en el backend NO llega a la UI
 * (mejor mostrar 3 carreras que una con las correlativas en círculo).
 */
export function sanear(reg: Registro): Registro {
  const planes = reg.planes.filter((p) => {
    if (esPublicable(p)) return true
    if (import.meta.env.DEV) {
      console.warn(
        `[planes] descarto "${p.carrera}" (${p.id}): ${erroresDe(p)
          .map((e) => e.mensaje)
          .join(' · ')}`,
      )
    }
    return false
  })
  const universidades = reg.universidades.filter((u) => !!u.id && !!u.nombre)
  return { universidades, planes }
}

/**
 * Serialización estable: ordena las CLAVES de cada objeto pero respeta el orden de
 * los arrays (en un plan, el orden de las materias es dato: es cómo se dibuja).
 * Hace falta porque los módulos TS del bundle y el JSON del backend traen las mismas
 * claves en distinto orden, y sin esto todo plan parecería siempre distinto.
 */
function estable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(estable).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${estable(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

/** ¿Dos registros tienen los mismos datos? (para no reescribir el caché al vicio) */
export function igualRegistro(a: Registro, b: Registro): boolean {
  return estable(a) === estable(b)
}

/** Caché del backend, o `null` si no hay, está vencido de versión o quedó ilegible. */
export function leerCache(): Registro | null {
  if (!tieneStorage()) return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as CacheGuardado
    if (c?.v !== CACHE_VERSION || !Array.isArray(c.planes) || !Array.isArray(c.universidades)) {
      return null
    }
    const reg = sanear({ universidades: c.universidades, planes: c.planes })
    return reg.planes.length ? reg : null
  } catch {
    return null
  }
}

/** Guarda el registro bajado del backend. Silencioso si el storage no está. */
export function guardarCache(reg: Registro): void {
  if (!tieneStorage()) return
  try {
    const c: CacheGuardado = { v: CACHE_VERSION, at: new Date().toISOString(), ...reg }
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* sin espacio o en modo privado: seguimos con el bundle, no es fatal */
  }
}

export function borrarCache(): void {
  if (!tieneStorage()) return
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* nada que hacer */
  }
}

/**
 * Qué planes usa la app en ESTA carga: el caché si sirve, el bundle si no.
 * Se llama una sola vez, al importar `data/planes`.
 */
export function registroInicial(bundle: Registro): Registro {
  const cache = leerCache()
  if (!cache) return bundle
  // el caché manda, pero si no trae universidades reusamos las del bundle (los
  // nombres son para mostrar; sin ellas la UI diría el slug)
  return {
    planes: cache.planes,
    universidades: cache.universidades.length ? cache.universidades : bundle.universidades,
  }
}

/**
 * Convierte una fila de la vista `plan_publicado` en un `PlanDef`, o `null` si la
 * forma no cierra. Es dato de red: se desconfía de todo, y las claves ausentes se
 * omiten (no se inventan `false`) para que quede idéntico a los módulos del bundle.
 */
export function filaAPlan(fila: unknown): PlanDef | null {
  if (typeof fila !== 'object' || fila === null) return null
  const f = fila as Record<string, unknown>
  const txt = (k: string): string | null => (typeof f[k] === 'string' && f[k] ? (f[k] as string) : null)
  const id = txt('id')
  const universidad = txt('universidad')
  const codigo = txt('codigo')
  const carrera = txt('carrera')
  const anio = typeof f.anio === 'number' ? f.anio : null
  if (!id || !universidad || !codigo || !carrera || anio === null) return null
  if (!Array.isArray(f.materias) || !Array.isArray(f.correlativas) || !Array.isArray(f.titulos)) {
    return null
  }

  const materias: PlanDef['materias'] = []
  for (const m of f.materias as Record<string, unknown>[]) {
    if (typeof m?.cod !== 'string' || typeof m.nom !== 'string') return null
    if (typeof m.anio !== 'number' || typeof m.cuatri !== 'number') return null
    materias.push({
      cod: m.cod,
      nom: m.nom,
      anio: m.anio,
      cuatri: m.cuatri,
      ...(m.opt === true ? { opt: true } : {}),
      ...(m.especial === true ? { especial: true } : {}),
    })
  }

  const correlativas: PlanDef['correlativas'] = []
  for (const c of f.correlativas as Record<string, unknown>[]) {
    if (typeof c?.cod !== 'string' || typeof c.requiere !== 'string') return null
    correlativas.push({ cod: c.cod, requiere: c.requiere })
  }

  const titulos: PlanDef['titulos'] = []
  for (const t of f.titulos as Record<string, unknown>[]) {
    if (typeof t?.nombre !== 'string' || typeof t.hastaAnio !== 'number') return null
    titulos.push({
      nombre: t.nombre,
      hastaAnio: t.hastaAnio,
      ...(typeof t.hastaCuatri === 'number' ? { hastaCuatri: t.hastaCuatri } : {}),
    })
  }

  return { id, universidad, codigo, anio, carrera, materias, correlativas, titulos }
}
