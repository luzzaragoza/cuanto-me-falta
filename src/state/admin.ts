// Administración de planes — la parte con I/O (las reglas puras están en `lib/admin.ts`).
//
// Todo lo de acá es de solo lectura por ahora: cargar quién sos y qué planes administrás.
// Las escrituras llegan con el editor. Si algo falla, se devuelve el error para mostrarlo
// tal cual: en una pantalla de administración, "no pude" sin decir por qué es peor que
// el mensaje crudo de la base.

import { supabase } from '../lib/supabase'
import type { Habilitacion, PerfilAdmin, Rol } from '../lib/admin'
import { esSuper } from '../lib/admin'
import type { Borrador, MateriaEdit } from '../lib/editorPlan'
import type { TituloPlan } from '../data/model'

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
 * Carga el rol y las habilitaciones de una sesión. Un usuario sin fila en `perfil`
 * cuenta como estudiante (es lo mismo que asume la base).
 *
 * ⚠️ El `user_id` se filtra EXPLÍCITAMENTE, y no es redundante: **el RLS es un límite
 * de permisos, no un `WHERE`**. La política de `perfil` deja leer la fila propia *o
 * todas* si sos superadmin — así que sin este filtro, un superadmin recibía el padrón
 * completo y `maybeSingle()` se rompía con "multiple rows returned" (pasó en
 * producción el 8-ago). Regla para todo lo que se agregue acá: si esperás una fila,
 * pedila por su clave; no delegues el recorte a la política.
 */
export async function cargarPerfilAdmin(userId: string): Promise<PerfilAdmin> {
  if (!supabase) return { rol: 'estudiante', habilitaciones: [] }
  const [rp, rh] = await Promise.all([
    supabase.from('perfil').select('rol').eq('user_id', userId).maybeSingle(),
    supabase
      .from('admin_uni')
      .select('universidad_id, crear, editar, eliminar, limite_planes')
      .eq('user_id', userId),
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

// ── Edición del borrador ──────────────────────────────────────────────────
// Las filas relacionales SON el borrador (ADR-12): lo que se escribe acá no lo ve
// ningún alumno hasta que se publica. Por eso se puede guardar seguido y sin miedo:
// cada acción de la UI es una escritura chica, no el plan entero en cada tecla.
//
// Todas devuelven `void` o tiran: el editor muestra el mensaje crudo de la base, que
// en una pantalla de administración es más útil que un "no pude" genérico.

/** Trae el borrador completo de un plan (materias, correlativas y títulos). */
export async function cargarBorrador(planId: string): Promise<Borrador> {
  if (!supabase) throw new Error('Sin backend configurado')
  const [rp, rm, rc, rt] = await Promise.all([
    supabase
      .from('plan')
      .select('id, universidad_id, codigo, anio, carrera')
      .eq('id', planId)
      .single(),
    supabase
      .from('materia')
      .select('cod, nom, anio, cuatri, opt, especial, orden')
      .eq('plan_id', planId)
      .order('anio')
      .order('cuatri')
      .order('orden'),
    supabase.from('correlativa').select('cod, requiere').eq('plan_id', planId).order('orden'),
    supabase
      .from('titulo')
      .select('id, nombre, hasta_anio, hasta_cuatri')
      .eq('plan_id', planId)
      .order('orden'),
  ])
  for (const r of [rp, rm, rc, rt]) if (r.error) throw new Error(r.error.message)
  const p = rp.data as { id: string; universidad_id: string; codigo: string; anio: number; carrera: string }
  return {
    id: p.id,
    universidad: p.universidad_id,
    codigo: p.codigo,
    anio: p.anio,
    carrera: p.carrera,
    materias: (rm.data ?? []).map((m) => ({
      cod: m.cod as string,
      nom: m.nom as string,
      anio: m.anio as number,
      cuatri: m.cuatri as number,
      opt: m.opt as boolean,
      especial: m.especial as boolean,
      orden: m.orden as number,
      codOriginal: m.cod as string,
    })),
    correlativas: (rc.data ?? []).map((c) => ({ cod: c.cod as string, requiere: c.requiere as string })),
    titulos: (rt.data ?? []).map((t) => ({
      nombre: t.nombre as string,
      hastaAnio: t.hasta_anio as number,
      ...(t.hasta_cuatri === null ? {} : { hastaCuatri: t.hasta_cuatri as number }),
    })),
  }
}

/**
 * Guarda una materia. Si cambió el código, se hace UPDATE sobre el código viejo: las
 * correlativas viajan solas gracias al `on update cascade` de la migración 005.
 */
export async function guardarMateria(planId: string, m: MateriaEdit): Promise<void> {
  if (!supabase) throw new Error('Sin backend configurado')
  const fila = {
    plan_id: planId,
    cod: m.cod.trim(),
    nom: m.nom.trim(),
    anio: m.anio,
    cuatri: m.cuatri,
    opt: m.opt,
    especial: m.especial,
    orden: m.orden,
  }
  const previo = m.codOriginal?.trim()
  const { error } =
    previo && previo !== fila.cod
      ? await supabase.from('materia').update(fila).eq('plan_id', planId).eq('cod', previo)
      : await supabase.from('materia').upsert(fila, { onConflict: 'plan_id,cod' })
  if (error) throw new Error(error.message)
}

/** Borra una materia. Sus correlativas se van con ella (cascade). */
export async function borrarMateria(planId: string, cod: string): Promise<void> {
  if (!supabase) throw new Error('Sin backend configurado')
  const { error } = await supabase.from('materia').delete().eq('plan_id', planId).eq('cod', cod)
  if (error) throw new Error(error.message)
}

/**
 * Reemplaza las previas de UNA materia. Se borran las suyas y se insertan las nuevas:
 * es una operación chica (una materia tiene 1-3 previas) y deja el estado exacto que
 * muestra la pantalla, sin diffs que puedan quedar a medio aplicar.
 */
export async function guardarPrevias(
  planId: string,
  cod: string,
  previas: string[],
): Promise<void> {
  if (!supabase) throw new Error('Sin backend configurado')
  const del = await supabase.from('correlativa').delete().eq('plan_id', planId).eq('cod', cod)
  if (del.error) throw new Error(del.error.message)
  if (previas.length === 0) return
  const { error } = await supabase.from('correlativa').insert(
    previas.map((requiere, i) => ({ plan_id: planId, cod, requiere, orden: i })),
  )
  if (error) throw new Error(error.message)
}

/** Reemplaza los títulos del plan (son pocos y se editan de a uno). */
export async function guardarTitulos(planId: string, titulos: TituloPlan[]): Promise<void> {
  if (!supabase) throw new Error('Sin backend configurado')
  const del = await supabase.from('titulo').delete().eq('plan_id', planId)
  if (del.error) throw new Error(del.error.message)
  if (titulos.length === 0) return
  const { error } = await supabase.from('titulo').insert(
    titulos.map((t, i) => ({
      plan_id: planId,
      nombre: t.nombre.trim(),
      hasta_anio: t.hastaAnio,
      hasta_cuatri: t.hastaCuatri ?? null,
      orden: i,
    })),
  )
  if (error) throw new Error(error.message)
}

/** Crea un plan vacío (en borrador). El id no se puede cambiar después: ver 005. */
export async function crearPlan(datos: {
  id: string
  universidad: string
  codigo: string
  anio: number
  carrera: string
}): Promise<void> {
  if (!supabase) throw new Error('Sin backend configurado')
  const { error } = await supabase.from('plan').insert({
    id: datos.id,
    universidad_id: datos.universidad,
    codigo: datos.codigo,
    anio: datos.anio,
    carrera: datos.carrera,
  })
  if (error) throw new Error(error.message)
}

/** Cambia la cabecera (nombre de carrera, código, año). El id queda fijo. */
export async function guardarCabecera(
  planId: string,
  datos: { codigo: string; anio: number; carrera: string },
): Promise<void> {
  if (!supabase) throw new Error('Sin backend configurado')
  const { error } = await supabase.from('plan').update(datos).eq('id', planId)
  if (error) throw new Error(error.message)
}

/**
 * Publica el borrador: la base saca la foto y mueve el puntero (ADR-12). Devuelve el
 * número de versión nueva. Rechaza planes estructuralmente roto con un mensaje claro,
 * así que su error se muestra tal cual.
 */
export async function publicarPlan(planId: string, nota: string | null): Promise<number> {
  if (!supabase) throw new Error('Sin backend configurado')
  const { data, error } = await supabase.rpc('publicar_plan', { p: planId, nota })
  if (error) throw new Error(error.message)
  return data as number
}

/** Vuelve a una versión anterior (mueve el puntero, no toca el borrador). */
export async function revertirPlan(planId: string, version: number): Promise<number> {
  if (!supabase) throw new Error('Sin backend configurado')
  const { data, error } = await supabase.rpc('revertir_plan', { p: planId, v: version })
  if (error) throw new Error(error.message)
  return data as number
}

/** Historial de versiones publicadas de un plan, la más nueva primero. */
export async function cargarVersiones(planId: string): Promise<
  Array<{ version: number; publicado_at: string; nota: string | null }>
> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('plan_version')
    .select('version, publicado_at, nota')
    .eq('plan_id', planId)
    .order('version', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{ version: number; publicado_at: string; nota: string | null }>
}
