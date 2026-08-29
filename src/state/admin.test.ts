import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AdminHabilitado, RepositorioPlanes } from './admin'
import { SesionAdmin, Habilitacion } from '../lib/admin'

// Estos tests existen porque el cliente entra por CONSTRUCTOR. Con el singleton del
// módulo, `state/admin.ts` era literalmente imposible de probar: cualquier caso
// necesitaba una sesión real de Google, así que su cobertura era cero — y ahí se escapó
// a producción el bug del 8-ago (ver el primer test).
//
// El doble no simula Postgres: registra QUÉ CONSULTA se armó. Es lo único que este
// módulo decide; lo que la base responde es problema del RLS, que se prueba aparte en
// `supabase/003-verificar-permisos.sql`.

interface Respuesta {
  data: unknown
  error: { message: string } | null
}

function clienteFalso(respuestas: Record<string, Respuesta>) {
  const consultas: string[] = []

  const tabla = (nombre: string) => {
    const filtros: string[] = []
    const registrar = (): Respuesta => {
      consultas.push(`${nombre}?${filtros.join('&')}`)
      return respuestas[nombre] ?? { data: [], error: null }
    }
    const q = {
      select: () => q,
      order: () => q,
      eq: (k: string, v: unknown) => {
        filtros.push(`${k}=${String(v)}`)
        return q
      },
      in: (k: string, v: string[]) => {
        filtros.push(`${k} in (${v.join(',')})`)
        return q
      },
      maybeSingle: () => Promise.resolve(registrar()),
      single: () => Promise.resolve(registrar()),
      // el builder de supabase-js es "thenable": await sobre la cadena la ejecuta
      then: (ok: (r: Respuesta) => unknown) => Promise.resolve(registrar()).then(ok),
    }
    return q
  }

  return {
    cliente: { from: tabla } as unknown as SupabaseClient,
    consultas,
  }
}

describe('RepositorioPlanes · cargarPerfil', () => {
  /**
   * REGRESIÓN del bug de producción del 8-ago. La política `perfil_lectura` es
   * `user_id = auth.uid() OR es_superadmin()`, así que para un superadmin devuelve el
   * padrón ENTERO y `maybeSingle()` reventaba con "multiple rows returned".
   *
   * La lección quedó en el código: **el RLS es un límite de permisos, no un `WHERE`**.
   * Si esperás una fila, pedila por su clave.
   */
  it('filtra por user_id en las DOS tablas, aunque el RLS ya recorte', async () => {
    const { cliente, consultas } = clienteFalso({
      perfil: { data: { rol: 'superadmin' }, error: null },
      admin_uni: { data: [], error: null },
    })
    await new RepositorioPlanes(cliente).cargarPerfil('u-1')

    expect(consultas).toContain('perfil?user_id=u-1')
    expect(consultas).toContain('admin_uni?user_id=u-1')
  })

  it('una cuenta sin fila en perfil cuenta como estudiante', async () => {
    const { cliente } = clienteFalso({
      perfil: { data: null, error: null },
      admin_uni: { data: [], error: null },
    })
    const s = await new RepositorioPlanes(cliente).cargarPerfil('u-1')
    expect(s.rol).toBe('estudiante')
    expect(SesionAdmin.acceso(true, true, s)).toBe('sin-permiso')
  })

  it('propaga el error de la base tal cual (la pantalla lo muestra crudo)', async () => {
    const { cliente } = clienteFalso({
      perfil: { data: null, error: { message: 'JSON object requested, multiple rows returned' } },
      admin_uni: { data: [], error: null },
    })
    await expect(new RepositorioPlanes(cliente).cargarPerfil('u-1')).rejects.toThrow(
      'multiple rows returned',
    )
  })
})

// La lista lee la VISTA `plan_editable`, no la tabla `plan`: la vista agrega
// `tiene_cambios`, que compara el borrador contra la foto publicada. Cuando esto se
// deducía de dos timestamps, los 4 planes de UADE decían "cambios sin publicar" para
// siempre (ver `supabase/009` y la regresión en `lib/admin.test.ts`).
describe('RepositorioPlanes · cargarPlanes', () => {
  it('el admin pide SOLO los de sus universidades (los publicados de otras serían ruido)', async () => {
    const { cliente, consultas } = clienteFalso({ plan_editable: { data: [], error: null } })
    const sesion = new SesionAdmin('admin_uni', [new Habilitacion('uade')])
    await new RepositorioPlanes(cliente).cargarPlanes(sesion)

    expect(consultas).toEqual(['plan_editable?universidad_id in (uade)'])
  })

  it('el superadmin no filtra: los ve todos', async () => {
    const { cliente, consultas } = clienteFalso({ plan_editable: { data: [], error: null } })
    await new RepositorioPlanes(cliente).cargarPlanes(new SesionAdmin('superadmin'))

    expect(consultas).toEqual(['plan_editable?'])
  })

  it('un admin sin ninguna universidad no consulta nada', async () => {
    const { cliente, consultas } = clienteFalso({ plan_editable: { data: [], error: null } })
    const planes = await new RepositorioPlanes(cliente).cargarPlanes(new SesionAdmin('admin_uni'))

    expect(planes).toEqual([])
    expect(consultas).toEqual([]) // ni siquiera se va al servidor
  })

  it('descarta filas que no tienen la forma esperada', async () => {
    const { cliente } = clienteFalso({
      plan_editable: {
        data: [
          { id: 'p1', universidad_id: 'uade', carrera: 'Ing.', estado: 'publicado', version_publicada: 2 },
          { sin: 'id' },
        ],
        error: null,
      },
    })
    const planes = await new RepositorioPlanes(cliente).cargarPlanes(new SesionAdmin('superadmin'))
    expect(planes.map((p) => p.id)).toEqual(['p1'])
    expect(planes[0].etiquetaEstado).toBe('Publicado · v2')
  })
})

describe('RepositorioPlanes · sin backend', () => {
  // En dev y en CI no hay credenciales de Supabase, y la app tiene que abrir igual.
  const sinBackend = new RepositorioPlanes(null)

  it('las lecturas devuelven vacío en vez de explotar', async () => {
    expect(sinBackend.hayBackend).toBe(false)
    expect((await sinBackend.cargarPerfil('u-1')).rol).toBe('estudiante')
    expect(await sinBackend.cargarPlanes(new SesionAdmin('superadmin'))).toEqual([])
    expect(await sinBackend.cargarUniversidades()).toEqual([])
    expect(await sinBackend.cargarPublicado('p')).toBeNull()
  })

  it('las escrituras sí tiran: guardar sin backend es un error de programación', async () => {
    await expect(sinBackend.borrarMateria('p', 'A')).rejects.toThrow('Sin backend')
    await expect(sinBackend.publicar('p', null)).rejects.toThrow('Sin backend')
  })
})

describe('AdminHabilitado · quién está habilitado', () => {
  const a = (over: Partial<ConstructorParameters<typeof AdminHabilitado>[0]> = {}) =>
    new AdminHabilitado({ user_id: 'u1', email: 'ana@uni.edu.ar', otorgado_at: null, ...over })

  // Estar en la lista ES poder todo en esa universidad (`supabase/010`), así que lo único
  // que queda por decir de cada uno es desde cuándo.
  it('dice desde cuándo está habilitado', () => {
    expect(a({ otorgado_at: '2026-08-12T15:00:00Z' }).resumen).toContain('desde el')
  })

  it('sin fecha no inventa una', () => {
    expect(a().resumen).toBe('habilitado')
    expect(a({ otorgado_at: 'cualquier cosa' }).resumen).toBe('habilitado')
  })

  it('se arma desde lo que devuelve la RPC y descarta filas raras', () => {
    expect(AdminHabilitado.desde({ user_id: 'u', email: 'x@y.z' })?.email).toBe('x@y.z')
    expect(AdminHabilitado.desde({ user_id: 'u' })).toBeNull() // sin mail no sirve
    expect(AdminHabilitado.desde(null)).toBeNull()
  })
})
