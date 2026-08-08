// Administración de planes — la parte con I/O (las reglas puras están en `lib/admin.ts`).
//
// Todo lo de acá es de solo lectura por ahora: cargar quién sos y qué planes administrás.
// Las escrituras llegan con el editor. Si algo falla, se devuelve el error para mostrarlo
// tal cual: en una pantalla de administración, "no pude" sin decir por qué es peor que
// el mensaje crudo de la base.

import { supabase } from '../lib/supabase'
import type { Habilitacion, PerfilAdmin, Rol } from '../lib/admin'
import { esSuper } from '../lib/admin'

/** Un plan tal como lo lista la administración (incluye los no publicados). */
export interface PlanAdmin {
  id: string
  universidad_id: string
  codigo: string
  anio: number
  carrera: string
  estado: string
  version_publicada: number | null
  actualizado_at: string | null
  publicado_at: string | null
}

export interface Universidad {
  id: string
  nombre: string
}

/**
 * Carga el rol y las habilitaciones de la sesión actual. Devuelve `null` si no hay
 * backend o sesión. Un usuario sin fila en `perfil` cuenta como estudiante (es lo
 * mismo que asume la base).
 */
export async function cargarPerfilAdmin(): Promise<PerfilAdmin> {
  if (!supabase) return { rol: 'estudiante', habilitaciones: [] }
  const [rp, rh] = await Promise.all([
    supabase.from('perfil').select('rol').maybeSingle(),
    supabase.from('admin_uni').select('universidad_id, crear, editar, eliminar, limite_planes'),
  ])
  if (rp.error) throw new Error(rp.error.message)
  if (rh.error) throw new Error(rh.error.message)
  const rol = (rp.data?.rol as Rol | undefined) ?? 'estudiante'
  return { rol, habilitaciones: (rh.data ?? []) as Habilitacion[] }
}

/**
 * Planes que administra esa persona. El superadmin ve todos; un admin, solo los de sus
 * universidades — el RLS le deja ver además los publicados de otras (son públicos), y
 * en esta pantalla eso sería ruido, así que se filtra.
 */
export async function cargarPlanesAdmin(perfil: PerfilAdmin): Promise<PlanAdmin[]> {
  if (!supabase) return []
  let q = supabase
    .from('plan')
    .select(
      'id, universidad_id, codigo, anio, carrera, estado, version_publicada, actualizado_at, publicado_at',
    )
    .order('universidad_id')
    .order('orden')
  if (!esSuper(perfil)) {
    const unis = perfil.habilitaciones.map((h) => h.universidad_id)
    if (unis.length === 0) return []
    q = q.in('universidad_id', unis)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as PlanAdmin[]
}

/** Nombres de universidad, para mostrar algo mejor que el slug. */
export async function cargarUniversidades(): Promise<Universidad[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('universidad').select('id, nombre').order('nombre')
  if (error) throw new Error(error.message)
  return (data ?? []) as Universidad[]
}
