// Refresco de los datos académicos contra el backend (la mitad con I/O del ADR-11).
//
// Corre UNA vez por carga, en segundo plano, después de que la app ya pintó. No
// reemplaza los planes en caliente: solo deja el caché listo para la próxima vez que
// se abra la app (ver el comentario largo en `src/data/registro.ts`).
//
// Nunca tira una excepción ni molesta al usuario: si no hay backend, si la tabla
// todavía no existe o si no hay red, la app sigue con los planes del bundle. Esa es
// exactamente la situación de dev, de CI y de cualquiera sin conexión.

import { supabase } from '../lib/supabase'
import { PLANES, PLANES_BUNDLE, UNIVERSIDADES_BUNDLE } from '../data/planes'
import { PlanActivo } from './planActivo'
import { Registro } from '../data/registro'
import { PlanDef, Universidad } from '../data/model'

export type ResultadoRefresco =
  /** No hay credenciales de Supabase: la app es 100% local. */
  | 'sin-backend'
  /** El backend dice lo mismo que ya tenemos. */
  | 'sin-cambios'
  /** Había algo distinto: quedó en el caché para la próxima carga. */
  | 'actualizado'
  /** El backend respondió sin un solo plan publicado — se ignora (no se borra nada). */
  | 'vacio'
  /** Red, permisos o tabla inexistente. Se ignora en silencio. */
  | 'error'

/** Espera antes de refrescar: primero que la app pinte y precargue lo suyo. */
const DEMORA_MS = 4000

let corrido = false

/** Baja los planes publicados y actualiza el caché si hace falta. */
async function refrescar(): Promise<ResultadoRefresco> {
  if (!supabase) return 'sin-backend'
  try {
    const [rp, ru] = await Promise.all([
      supabase
        .from('plan_publicado')
        .select('id,universidad,codigo,anio,carrera,materias,correlativas,titulos')
        .order('orden')
        .order('carrera'),
      supabase.from('universidad').select('id,nombre').eq('activa', true).order('nombre'),
    ])
    if (rp.error || ru.error) return avisar('error', rp.error?.message ?? ru.error?.message)

    // La vista devuelve un plan por fila con la forma de `PlanJSON`, así que la fila ES
    // el JSON: entra derecho por la factory, que es la única frontera del modelo.
    const planes = (rp.data ?? [])
      .map((fila) => PlanDef.desde(fila))
      .filter((p): p is PlanDef => p !== null)
    if (planes.length !== (rp.data ?? []).length) {
      avisar('error', 'alguna fila de plan_publicado no tiene la forma esperada')
    }
    const universidades = (ru.data ?? [])
      .map((u) => Universidad.desde(u))
      .filter((u): u is Universidad => u !== null)

    const remoto = new Registro(universidades, planes).saneado()
    if (!remoto.hayPlanes) return avisar('vacio', 'sin planes publicados')

    const bundle = new Registro(UNIVERSIDADES_BUNDLE, PLANES_BUNDLE)
    // Si el backend dice exactamente lo que ya viaja en el bundle, no guardamos nada:
    // el caché solo existe cuando el backend DIVERGE del snapshot publicado. Así el día
    // que esto se estrena no cambia absolutamente nada del comportamiento actual.
    if (remoto.igualA(bundle)) {
      if (Registro.leerCache()) Registro.borrarCache()
      return 'sin-cambios'
    }
    const cache = Registro.leerCache()
    if (cache && remoto.igualA(cache)) return 'sin-cambios'

    remoto.guardarEnCache()
    if (import.meta.env.DEV) {
      console.info(`[planes] caché actualizado: ${remoto.planes.length} planes del backend`)
    }
    // ¿Cambió LA CARRERA QUE ESTÁ MIRANDO, o cambió otra? Solo lo primero merece
    // interrumpirla: avisarle "hay una versión nueva" porque se corrigió un plan de
    // otra carrera sería ruido puro.
    if (cambióSuPlan(remoto)) alHaberVersionNueva?.()
    return 'actualizado'
  } catch (e) {
    return avisar('error', e instanceof Error ? e.message : String(e))
  }
}

/**
 * ¿La versión nueva toca el plan que el usuario tiene abierto?
 *
 * Los dos lados se comparan por su forma canónica (`aJSON()`), que arma las claves
 * siempre en el mismo orden: dos planes con los mismos datos dan el mismo string
 * aunque hayan llegado por caminos distintos (bundle vs. backend).
 */
function cambióSuPlan(remoto: Registro): boolean {
  const id = PlanActivo.id()
  const nuevo = remoto.plan(id)
  const actual = PLANES.find((p) => p.id === id)
  if (!nuevo || !actual) return false
  return JSON.stringify(nuevo.aJSON()) !== JSON.stringify(actual.aJSON())
}

/** Se llama cuando el plan que el usuario está mirando cambió en el backend. */
let alHaberVersionNueva: (() => void) | undefined

/** Programa el refresco para cuando el navegador esté tranquilo. No bloquea nada. */
function programar(): void {
  if (corrido || !supabase) return
  corrido = true
  const lanzar = (): void => {
    void refrescar()
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(lanzar, { timeout: DEMORA_MS })
  } else {
    setTimeout(lanzar, DEMORA_MS)
  }
}

function avisar<T extends ResultadoRefresco>(r: T, detalle?: string): T {
  if (import.meta.env.DEV) console.warn(`[planes] ${r}${detalle ? `: ${detalle}` : ''}`)
  return r
}

/**
 * El refresco de los datos académicos contra el backend (la mitad con I/O del ADR-11).
 *
 * Corre UNA vez por carga, en segundo plano, y solo deja el caché listo para la próxima
 * vez que se abra la app: no reemplaza los planes en caliente.
 */
export class RefrescoDePlanes {
  /** Baja los planes publicados y actualiza el caché si hace falta. */
  static correr(): Promise<ResultadoRefresco> {
    return refrescar()
  }

  /**
   * Lo agenda para cuando el navegador esté tranquilo. No bloquea nada.
   *
   * `onVersionNueva` se llama SOLO si cambió el plan que el usuario tiene abierto. No se
   * reemplaza nada en caliente: el plan nuevo queda en el caché y entra en la próxima
   * carga. Decisión de producto (Luz, 8-ago): nada cambia debajo del mouse de nadie —
   * se avisa y decide la persona.
   */
  static programar(onVersionNueva?: () => void): void {
    alHaberVersionNueva = onVersionNueva
    programar()
  }
}
