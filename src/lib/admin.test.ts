import { describe, it, expect } from 'vitest'
import {
  cupoDe,
  decidirAcceso,
  estadoPlan,
  habilitacionDe,
  puedeEditar,
  puedeEliminar,
  tieneCambiosSinPublicar,
  type PerfilAdmin,
} from './admin'

const hab = (over: Partial<PerfilAdmin['habilitaciones'][0]> = {}) => ({
  universidad_id: 'uade',
  crear: true,
  editar: true,
  eliminar: false,
  limite_planes: 6,
  ...over,
})

const alumno: PerfilAdmin = { rol: 'estudiante', habilitaciones: [] }
const admin: PerfilAdmin = { rol: 'admin_uni', habilitaciones: [hab()] }
const superadmin: PerfilAdmin = { rol: 'superadmin', habilitaciones: [] }

describe('admin · quién entra a la administración', () => {
  it('sin backend configurado no hay administración (dev/CI)', () => {
    expect(decidirAcceso(false, true, superadmin)).toBe('sin-backend')
  })

  it('sin sesión pide iniciar sesión', () => {
    expect(decidirAcceso(true, false, null)).toBe('sin-sesion')
  })

  it('con sesión pero sin el perfil cargado, espera', () => {
    expect(decidirAcceso(true, true, null)).toBe('cargando')
  })

  it('un estudiante no entra', () => {
    expect(decidirAcceso(true, true, alumno)).toBe('sin-permiso')
  })

  it('un admin_uni SIN habilitaciones tampoco entra (el rol solo no alcanza)', () => {
    expect(decidirAcceso(true, true, { rol: 'admin_uni', habilitaciones: [] })).toBe('sin-permiso')
  })

  it('un admin con al menos una universidad entra', () => {
    expect(decidirAcceso(true, true, admin)).toBe('ok')
  })

  it('el superadmin entra sin necesitar habilitaciones', () => {
    expect(decidirAcceso(true, true, superadmin)).toBe('ok')
  })
})

describe('admin · permisos por universidad', () => {
  it('el admin puede editar en la suya y en ninguna otra', () => {
    expect(puedeEditar(admin, 'uade')).toBe(true)
    expect(puedeEditar(admin, 'otra')).toBe(false)
  })

  it('el permiso de eliminar es aparte del de editar', () => {
    expect(puedeEditar(admin, 'uade')).toBe(true)
    expect(puedeEliminar(admin, 'uade')).toBe(false)
    const conBorrado: PerfilAdmin = { rol: 'admin_uni', habilitaciones: [hab({ eliminar: true })] }
    expect(puedeEliminar(conBorrado, 'uade')).toBe(true)
  })

  it('el superadmin puede en cualquier universidad', () => {
    expect(puedeEditar(superadmin, 'cualquiera')).toBe(true)
    expect(puedeEliminar(superadmin, 'cualquiera')).toBe(true)
  })

  it('habilitacionDe no inventa nada', () => {
    expect(habilitacionDe(admin, 'uade')?.limite_planes).toBe(6)
    expect(habilitacionDe(admin, 'otra')).toBeUndefined()
  })
})

describe('admin · cupo de planes', () => {
  it('cuenta los que quedan y lo dice en palabras', () => {
    const c = cupoDe(admin, 'uade', 4)
    expect(c).toMatchObject({ usados: 4, limite: 6, disponibles: 2, puedeCrear: true })
    expect(c.leyenda).toBe('4 de 6 · podés crear 2 más')
  })

  it('en el límite, no puede crear', () => {
    const c = cupoDe(admin, 'uade', 6)
    expect(c.puedeCrear).toBe(false)
    expect(c.leyenda).toBe('6 de 6 · llegaste al límite')
  })

  it('pasado el límite (bajado a mano por el superadmin) no queda en negativo', () => {
    const c = cupoDe(admin, 'uade', 9)
    expect(c.disponibles).toBe(0)
    expect(c.puedeCrear).toBe(false)
  })

  it('sin permiso de crear, el cupo lo dice', () => {
    const soloLectura: PerfilAdmin = { rol: 'admin_uni', habilitaciones: [hab({ crear: false })] }
    const c = cupoDe(soloLectura, 'uade', 2)
    expect(c.puedeCrear).toBe(false)
    expect(c.leyenda).toContain('no podés crear planes nuevos')
  })

  it('el superadmin no tiene límite', () => {
    const c = cupoDe(superadmin, 'uade', 12)
    expect(c).toMatchObject({ limite: null, disponibles: null, puedeCrear: true })
    expect(c.leyenda).toBe('12 planes · sin límite')
  })

  it('el singular no queda mal escrito', () => {
    expect(cupoDe(superadmin, 'uade', 1).leyenda).toBe('1 plan · sin límite')
  })
})

describe('admin · cómo se muestra el estado de un plan', () => {
  it('publicado dice qué versión ve el alumno', () => {
    expect(estadoPlan('publicado', 3)).toBe('Publicado · v3')
  })

  it('sin foto publicada, el alumno no lo ve', () => {
    expect(estadoPlan('publicado', null)).toBe('Sin publicar')
    expect(estadoPlan('borrador', null)).toBe('Sin publicar')
  })

  it('detecta borrador con cambios sin publicar', () => {
    expect(tieneCambiosSinPublicar('2026-08-09T12:00:00Z', '2026-08-08T12:00:00Z')).toBe(true)
    expect(tieneCambiosSinPublicar('2026-08-08T12:00:00Z', '2026-08-09T12:00:00Z')).toBe(false)
  })

  it('publicar toca la fila del plan: no cuenta como cambio pendiente', () => {
    // los dos sellos quedan a milisegundos, dentro de la tolerancia
    expect(tieneCambiosSinPublicar('2026-08-08T12:00:01Z', '2026-08-08T12:00:00Z')).toBe(false)
  })

  it('nunca publicado con borrador editado: sí tiene cambios', () => {
    expect(tieneCambiosSinPublicar('2026-08-08T12:00:00Z', null)).toBe(true)
  })
})
