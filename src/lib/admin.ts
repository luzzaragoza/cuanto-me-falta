// Reglas de acceso a la administración de planes — la parte PURA.
//
// La base es la que manda: las políticas de RLS deciden de verdad quién puede
// escribir qué (ver `supabase/002-perfiles-y-permisos.sql`). Esto es solo para que la
// interfaz sepa qué mostrar y qué deshabilitar: nunca es la única defensa. Si algo de
// acá dijera "sí" y la base "no", gana la base — y el editor muestra el error.
//
// Vive en `lib/` y es puro para poder testear las combinaciones sin backend.

/** Lo que un admin puede hacer en UNA universidad (fila de `admin_uni`). */
export interface Habilitacion {
  universidad_id: string
  crear: boolean
  editar: boolean
  eliminar: boolean
  limite_planes: number
}

export type Rol = 'superadmin' | 'admin_uni' | 'estudiante'

export interface PerfilAdmin {
  rol: Rol
  /** Habilitaciones por universidad. Para el superadmin no hace falta ninguna. */
  habilitaciones: Habilitacion[]
}

/** En qué estado está el acceso a `#admin`, que es lo que decide qué pantalla mostrar. */
export type Acceso =
  | 'cargando'
  | 'sin-backend' // la app corre sin credenciales de Supabase (dev/CI)
  | 'sin-sesion' // hay que iniciar sesión
  | 'sin-permiso' // sesión válida, pero esta cuenta no administra nada
  | 'ok'

/** Decide el acceso con lo que se sabe. `perfil === null` = todavía no cargó. */
export function decidirAcceso(
  hayBackend: boolean,
  haySesion: boolean,
  perfil: PerfilAdmin | null,
): Acceso {
  if (!hayBackend) return 'sin-backend'
  if (!haySesion) return 'sin-sesion'
  if (perfil === null) return 'cargando'
  if (perfil.rol === 'superadmin') return 'ok'
  return perfil.habilitaciones.length > 0 ? 'ok' : 'sin-permiso'
}

/** ¿Es superadmin? (puede en todas las universidades, sin fila de habilitación) */
export function esSuper(perfil: PerfilAdmin): boolean {
  return perfil.rol === 'superadmin'
}

/** Habilitación en una universidad, o `undefined` si no tiene. */
export function habilitacionDe(perfil: PerfilAdmin, uni: string): Habilitacion | undefined {
  return perfil.habilitaciones.find((h) => h.universidad_id === uni)
}

/** ¿Puede editar planes de esa universidad? */
export function puedeEditar(perfil: PerfilAdmin, uni: string): boolean {
  return esSuper(perfil) || habilitacionDe(perfil, uni)?.editar === true
}

/** ¿Puede eliminar planes de esa universidad? */
export function puedeEliminar(perfil: PerfilAdmin, uni: string): boolean {
  return esSuper(perfil) || habilitacionDe(perfil, uni)?.eliminar === true
}

/**
 * Cupo de planes de una universidad: cuántos hay, cuántos permite y si entra otro.
 * El superadmin no tiene límite (`limite === null`).
 */
export interface Cupo {
  usados: number
  limite: number | null
  disponibles: number | null
  puedeCrear: boolean
  /** Texto listo para la UI. */
  leyenda: string
}

export function cupoDe(perfil: PerfilAdmin, uni: string, planesActuales: number): Cupo {
  if (esSuper(perfil)) {
    return {
      usados: planesActuales,
      limite: null,
      disponibles: null,
      puedeCrear: true,
      leyenda: `${planesActuales} ${planesActuales === 1 ? 'plan' : 'planes'} · sin límite`,
    }
  }
  const h = habilitacionDe(perfil, uni)
  if (!h || !h.crear) {
    return {
      usados: planesActuales,
      limite: h?.limite_planes ?? 0,
      disponibles: 0,
      puedeCrear: false,
      leyenda: `${planesActuales} de ${h?.limite_planes ?? 0} · no podés crear planes nuevos`,
    }
  }
  const disponibles = Math.max(0, h.limite_planes - planesActuales)
  return {
    usados: planesActuales,
    limite: h.limite_planes,
    disponibles,
    puedeCrear: disponibles > 0,
    leyenda:
      disponibles > 0
        ? `${planesActuales} de ${h.limite_planes} · podés crear ${disponibles} más`
        : `${planesActuales} de ${h.limite_planes} · llegaste al límite`,
  }
}

/** Cómo se muestra el estado de un plan en la lista. */
export function estadoPlan(estado: string, versionPublicada: number | null): string {
  if (estado !== 'publicado' || versionPublicada === null) return 'Sin publicar'
  return `Publicado · v${versionPublicada}`
}

/**
 * ¿El borrador tiene cambios sin publicar? Se compara la última edición de las filas
 * (el borrador) contra cuándo se publicó la foto que está viendo el alumno.
 */
export function tieneCambiosSinPublicar(
  actualizadoAt: string | null,
  publicadoAt: string | null,
): boolean {
  if (!actualizadoAt) return false
  if (!publicadoAt) return true
  const a = Date.parse(actualizadoAt)
  const p = Date.parse(publicadoAt)
  if (Number.isNaN(a) || Number.isNaN(p)) return false
  // 2s de tolerancia: publicar toca la fila del plan, así que los dos sellos quedan
  // casi iguales y no queremos que eso se vea como "tiene cambios sin publicar".
  return a - p > 2000
}
