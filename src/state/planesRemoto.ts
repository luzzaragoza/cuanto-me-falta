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
import { PLANES_BUNDLE, UNIVERSIDADES_BUNDLE } from '../data/planes'
import {
  borrarCache,
  filaAPlan,
  guardarCache,
  igualRegistro,
  leerCache,
  sanear,
  type Registro,
} from '../data/registro'
import type { Universidad } from '../data/model'

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
export async function refrescarPlanes(): Promise<ResultadoRefresco> {
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

    const planes = (rp.data ?? []).map(filaAPlan).filter((p) => p !== null)
    if (planes.length !== (rp.data ?? []).length) {
      avisar('error', 'alguna fila de plan_publicado no tiene la forma esperada')
    }
    const universidades = (ru.data ?? []).filter(
      (u): u is Universidad => typeof u?.id === 'string' && typeof u?.nombre === 'string',
    )

    const remoto = sanear({ universidades, planes })
    if (remoto.planes.length === 0) return avisar('vacio', 'sin planes publicados')

    const bundle: Registro = { universidades: UNIVERSIDADES_BUNDLE, planes: PLANES_BUNDLE }
    // Si el backend dice exactamente lo que ya viaja en el bundle, no guardamos nada:
    // el caché solo existe cuando el backend DIVERGE del snapshot publicado. Así el día
    // que esto se estrena no cambia absolutamente nada del comportamiento actual.
    if (igualRegistro(remoto, bundle)) {
      if (leerCache()) borrarCache()
      return 'sin-cambios'
    }
    const cache = leerCache()
    if (cache && igualRegistro(remoto, cache)) return 'sin-cambios'

    guardarCache(remoto)
    if (import.meta.env.DEV) {
      console.info(`[planes] caché actualizado: ${remoto.planes.length} planes del backend`)
    }
    return 'actualizado'
  } catch (e) {
    return avisar('error', e instanceof Error ? e.message : String(e))
  }
}

/** Programa el refresco para cuando el navegador esté tranquilo. No bloquea nada. */
export function programarRefresco(): void {
  if (corrido || !supabase) return
  corrido = true
  const lanzar = (): void => {
    void refrescarPlanes()
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
