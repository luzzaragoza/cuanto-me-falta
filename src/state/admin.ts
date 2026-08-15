// El repositorio de planes: todo el I/O de la administración contra Supabase.
//
// Las reglas puras están en `lib/admin.ts`; acá solo se lee y se escribe. Si algo falla,
// se propaga el error para mostrarlo tal cual: en una pantalla de administración, "no
// pude" sin decir por qué es peor que el mensaje crudo de la base.
//
// EL CLIENTE ENTRA POR CONSTRUCTOR. No es ceremonia: `state/admin.ts` era imposible de
// probar porque tomaba el singleton `supabase` del módulo, así que cualquier test
// necesitaba una sesión real de Google. Con el cliente inyectado se le puede pasar un
// doble y afirmar QUÉ consulta se arma — que es donde vivió el bug de producción del
// 8-ago (ver `cargarPerfil`).
//
// Las escrituras devuelven `void` o tiran.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PlanAdmin, SesionAdmin } from '../lib/admin'
import { Borrador, MateriaEdit } from '../lib/editorPlan'
import { Correlativa, PlanDef, TituloPlan } from '../data/model'

/** Una universidad tal como la lista la administración. */
export class UniversidadAdmin {
  readonly id: string
  readonly nombre: string
  /** Cuántos planes puede tener. Es de la universidad, no del admin (migración 006). */
  readonly limite_planes: number

  constructor(id: string, nombre: string, limite_planes = 0) {
    this.id = id
    this.nombre = nombre
    this.limite_planes = limite_planes
  }

  static desde(j: unknown): UniversidadAdmin | null {
    if (typeof j !== 'object' || j === null) return null
    const o = j as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.nombre !== 'string') return null
    return new UniversidadAdmin(
      o.id,
      o.nombre,
      typeof o.limite_planes === 'number' ? o.limite_planes : 0,
    )
  }
}

/** Una versión publicada, tal como la lista el historial. */
export interface VersionPlan {
  version: number
  publicado_at: string
  nota: string | null
}

export class RepositorioPlanes {
  private readonly db: SupabaseClient | null

  constructor(cliente: SupabaseClient | null = supabase) {
    this.db = cliente
  }

  /** ¿Hay backend configurado? (en dev y CI no lo hay, y la app tiene que funcionar) */
  get hayBackend(): boolean {
    return this.db !== null
  }

  private exigir(): SupabaseClient {
    if (!this.db) throw new Error('Sin backend configurado')
    return this.db
  }

  // ── lectura ─────────────────────────────────────────────────────────────

  /**
   * El rol y las habilitaciones de una sesión. Una cuenta sin fila en `perfil` cuenta
   * como estudiante (es lo mismo que asume la base).
   *
   * ⚠️ El `user_id` se filtra EXPLÍCITAMENTE, y no es redundante: **el RLS es un límite
   * de permisos, no un `WHERE`**. La política de `perfil` deja leer la fila propia *o
   * todas* si sos superadmin — así que sin este filtro, un superadmin recibía el padrón
   * completo y `maybeSingle()` se rompía con "multiple rows returned" (pasó en
   * producción el 8-ago). Regla para todo lo que se agregue acá: si esperás una fila,
   * pedila por su clave; no delegues el recorte a la política.
   */
  async cargarPerfil(userId: string): Promise<SesionAdmin> {
    if (!this.db) return SesionAdmin.estudiante()
    const [rp, rh] = await Promise.all([
      this.db.from('perfil').select('rol').eq('user_id', userId).maybeSingle(),
      this.db
        .from('admin_uni')
        .select('universidad_id, crear, editar, eliminar')
        .eq('user_id', userId),
    ])
    if (rp.error) throw new Error(rp.error.message)
    if (rh.error) throw new Error(rh.error.message)
    return SesionAdmin.desde(rp.data?.rol, rh.data ?? [])
  }

  /**
   * Planes que administra esa persona. El superadmin ve todos; un admin, solo los de sus
   * universidades — el RLS le deja ver además los publicados de otras (son públicos), y
   * en esta pantalla eso sería ruido, así que se filtra.
   */
  async cargarPlanes(sesion: SesionAdmin): Promise<PlanAdmin[]> {
    if (!this.db) return []
    let q = this.db
      .from('plan')
      .select(
        'id, universidad_id, codigo, anio, carrera, estado, version_publicada, actualizado_at, publicado_at',
      )
      .order('universidad_id')
      .order('orden')
    if (!sesion.esSuper) {
      const unis = sesion.universidades
      if (unis.length === 0) return []
      q = q.in('universidad_id', unis)
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data ?? []).map((f) => PlanAdmin.desde(f)).filter((p): p is PlanAdmin => p !== null)
  }

  /** Nombres de universidad y su cupo, para mostrar algo mejor que el slug. */
  async cargarUniversidades(): Promise<UniversidadAdmin[]> {
    if (!this.db) return []
    const { data, error } = await this.db
      .from('universidad')
      .select('id, nombre, limite_planes')
      .order('nombre')
    if (error) throw new Error(error.message)
    return (data ?? [])
      .map((f) => UniversidadAdmin.desde(f))
      .filter((u): u is UniversidadAdmin => u !== null)
  }

  /**
   * El borrador completo de un plan (materias, correlativas y títulos).
   *
   * Las filas relacionales SON el borrador (ADR-12): lo que se escribe acá no lo ve
   * ningún alumno hasta que se publica. Por eso el editor puede guardar seguido y sin
   * miedo: cada acción es una escritura chica, no el plan entero en cada tecla.
   */
  async cargarBorrador(planId: string): Promise<Borrador> {
    const db = this.exigir()
    const [rp, rm, rc, rt] = await Promise.all([
      db.from('plan').select('id, universidad_id, codigo, anio, carrera').eq('id', planId).single(),
      db
        .from('materia')
        .select('cod, nom, anio, cuatri, opt, especial, orden')
        .eq('plan_id', planId)
        .order('anio')
        .order('cuatri')
        .order('orden'),
      db.from('correlativa').select('cod, requiere').eq('plan_id', planId).order('orden'),
      db
        .from('titulo')
        .select('id, nombre, hasta_anio, hasta_cuatri')
        .eq('plan_id', planId)
        .order('orden'),
    ])
    for (const r of [rp, rm, rc, rt]) if (r.error) throw new Error(r.error.message)
    const p = rp.data as {
      id: string
      universidad_id: string
      codigo: string
      anio: number
      carrera: string
    }
    return new Borrador({
      id: p.id,
      universidad: p.universidad_id,
      codigo: p.codigo,
      anio: p.anio,
      carrera: p.carrera,
      materias: (rm.data ?? []).map(
        (m) =>
          new MateriaEdit({
            cod: m.cod as string,
            nom: m.nom as string,
            anio: m.anio as number,
            cuatri: m.cuatri as number,
            opt: m.opt as boolean,
            especial: m.especial as boolean,
            orden: m.orden as number,
            codOriginal: m.cod as string,
          }),
      ),
      correlativas: (rc.data ?? []).map(
        (c) => new Correlativa(c.cod as string, c.requiere as string),
      ),
      titulos: (rt.data ?? []).map(
        (t) =>
          new TituloPlan(
            t.nombre as string,
            t.hasta_anio as number,
            t.hasta_cuatri === null ? undefined : (t.hasta_cuatri as number),
          ),
      ),
    })
  }

  /** Historial de versiones publicadas, la más nueva primero. */
  async cargarVersiones(planId: string): Promise<VersionPlan[]> {
    if (!this.db) return []
    const { data, error } = await this.db
      .from('plan_version')
      .select('version, publicado_at, nota')
      .eq('plan_id', planId)
      .order('version', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as VersionPlan[]
  }

  /**
   * La foto que están viendo los alumnos, o `null` si el plan nunca se publicó. Es
   * contra esto que se compara el borrador para armar la lista de cambios sin publicar.
   * Entra por `PlanDef.desde()`, la misma factory que usa el arranque de la app: si la
   * vista cambiara de forma, se rompe en un solo lugar.
   */
  async cargarPublicado(planId: string): Promise<PlanDef | null> {
    if (!this.db) return null
    const { data, error } = await this.db
      .from('plan_publicado')
      .select('id,universidad,codigo,anio,carrera,materias,correlativas,titulos')
      .eq('id', planId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? PlanDef.desde(data) : null
  }

  // ── escritura ───────────────────────────────────────────────────────────

  /**
   * Guarda una materia. Si cambió el código, se hace UPDATE sobre el código viejo: las
   * correlativas viajan solas gracias al `on update cascade` de la migración 005.
   */
  async guardarMateria(planId: string, m: MateriaEdit): Promise<void> {
    const db = this.exigir()
    const fila = {
      plan_id: planId,
      cod: m.codLimpio,
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
        ? await db.from('materia').update(fila).eq('plan_id', planId).eq('cod', previo)
        : await db.from('materia').upsert(fila, { onConflict: 'plan_id,cod' })
    if (error) throw new Error(error.message)
  }

  /** Borra una materia. Sus correlativas se van con ella (cascade). */
  async borrarMateria(planId: string, cod: string): Promise<void> {
    const db = this.exigir()
    const { error } = await db.from('materia').delete().eq('plan_id', planId).eq('cod', cod)
    if (error) throw new Error(error.message)
  }

  /**
   * Reemplaza las previas de UNA materia. Se borran las suyas y se insertan las nuevas:
   * es una operación chica (una materia tiene 1-3 previas) y deja el estado exacto que
   * muestra la pantalla, sin diffs que puedan quedar a medio aplicar.
   */
  async guardarPrevias(planId: string, cod: string, previas: string[]): Promise<void> {
    const db = this.exigir()
    const del = await db.from('correlativa').delete().eq('plan_id', planId).eq('cod', cod)
    if (del.error) throw new Error(del.error.message)
    if (previas.length === 0) return
    const { error } = await db
      .from('correlativa')
      .insert(previas.map((requiere, i) => ({ plan_id: planId, cod, requiere, orden: i })))
    if (error) throw new Error(error.message)
  }

  /** Reemplaza los títulos del plan (son pocos y se editan de a uno). */
  async guardarTitulos(planId: string, titulos: readonly TituloPlan[]): Promise<void> {
    const db = this.exigir()
    const del = await db.from('titulo').delete().eq('plan_id', planId)
    if (del.error) throw new Error(del.error.message)
    if (titulos.length === 0) return
    const { error } = await db.from('titulo').insert(
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
  async crearPlan(datos: {
    id: string
    universidad: string
    codigo: string
    anio: number
    carrera: string
  }): Promise<void> {
    const db = this.exigir()
    const { error } = await db.from('plan').insert({
      id: datos.id,
      universidad_id: datos.universidad,
      codigo: datos.codigo,
      anio: datos.anio,
      carrera: datos.carrera,
    })
    if (error) throw new Error(error.message)
  }

  /** Cambia la cabecera (nombre de carrera, código, año). El id queda fijo. */
  async guardarCabecera(
    planId: string,
    datos: { codigo: string; anio: number; carrera: string },
  ): Promise<void> {
    const db = this.exigir()
    const { error } = await db.from('plan').update(datos).eq('id', planId)
    if (error) throw new Error(error.message)
  }

  /**
   * Publica el borrador: la base saca la foto y mueve el puntero (ADR-12). Devuelve el
   * número de versión nueva. Rechaza planes estructuralmente rotos con un mensaje claro,
   * así que su error se muestra tal cual.
   */
  async publicar(planId: string, nota: string | null): Promise<number> {
    const db = this.exigir()
    const { data, error } = await db.rpc('publicar_plan', { p: planId, nota })
    if (error) throw new Error(error.message)
    return data as number
  }

  /** Vuelve a una versión anterior (mueve el puntero, no toca el borrador). */
  async revertir(planId: string, version: number): Promise<number> {
    const db = this.exigir()
    const { data, error } = await db.rpc('revertir_plan', { p: planId, v: version })
    if (error) throw new Error(error.message)
    return data as number
  }
}

/** El repositorio que usa la app, sobre el cliente real. */
export const repo = new RepositorioPlanes()
