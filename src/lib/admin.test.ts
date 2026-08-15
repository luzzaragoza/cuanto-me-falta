import { describe, it, expect } from 'vitest'
import { Habilitacion, PlanAdmin, PlanNuevo, SesionAdmin, UniversidadNueva } from './admin'

const hab = (over: Partial<{ crear: boolean; editar: boolean; eliminar: boolean }> = {}) =>
  new Habilitacion(
    'uade',
    over.crear ?? true,
    over.editar ?? true,
    over.eliminar ?? false,
  )

/** El cupo de UADE en la base. Es de la universidad, no de quien pregunta (006). */
const LIMITE_UADE = 6

const alumno = new SesionAdmin('estudiante')
const admin = new SesionAdmin('admin_uni', [hab()])
const superadmin = new SesionAdmin('superadmin')

describe('SesionAdmin · quién entra a la administración', () => {
  it('sin backend configurado no hay administración (dev/CI)', () => {
    expect(SesionAdmin.acceso(false, true, superadmin)).toBe('sin-backend')
  })

  it('sin sesión pide iniciar sesión', () => {
    expect(SesionAdmin.acceso(true, false, null)).toBe('sin-sesion')
  })

  it('con sesión pero sin el perfil cargado, espera', () => {
    expect(SesionAdmin.acceso(true, true, null)).toBe('cargando')
  })

  it('un estudiante no entra', () => {
    expect(SesionAdmin.acceso(true, true, alumno)).toBe('sin-permiso')
  })

  it('un admin_uni SIN habilitaciones tampoco entra (el rol solo no alcanza)', () => {
    expect(SesionAdmin.acceso(true, true, new SesionAdmin('admin_uni'))).toBe('sin-permiso')
  })

  it('un admin con al menos una universidad entra', () => {
    expect(SesionAdmin.acceso(true, true, admin)).toBe('ok')
  })

  it('el superadmin entra sin necesitar habilitaciones', () => {
    expect(SesionAdmin.acceso(true, true, superadmin)).toBe('ok')
  })
})

describe('SesionAdmin · permisos por universidad', () => {
  it('el admin puede editar en la suya y en ninguna otra', () => {
    expect(admin.puedeEditar('uade')).toBe(true)
    expect(admin.puedeEditar('otra')).toBe(false)
  })

  it('el permiso de eliminar es aparte del de editar', () => {
    expect(admin.puedeEditar('uade')).toBe(true)
    expect(admin.puedeEliminar('uade')).toBe(false)
    const conBorrado = new SesionAdmin('admin_uni', [hab({ eliminar: true })])
    expect(conBorrado.puedeEliminar('uade')).toBe(true)
  })

  it('el superadmin puede en cualquier universidad', () => {
    expect(superadmin.puedeEditar('cualquiera')).toBe(true)
    expect(superadmin.puedeEliminar('cualquiera')).toBe(true)
  })

  it('habilitacionEn no inventa nada', () => {
    expect(admin.habilitacionEn('uade')?.crear).toBe(true)
    expect(admin.habilitacionEn('otra')).toBeUndefined()
  })

  it('lista las universidades que administra (para filtrar la consulta)', () => {
    expect(admin.universidades).toEqual(['uade'])
    expect(superadmin.universidades).toEqual([])
  })

  it('se arma desde lo que devuelve la base, descartando filas raras', () => {
    const s = SesionAdmin.desde('admin_uni', [
      { universidad_id: 'uade', crear: true, editar: true, eliminar: false },
      { no: 'es una habilitación' },
    ])
    expect(s.rol).toBe('admin_uni')
    expect(s.universidades).toEqual(['uade'])
  })

  it('un rol desconocido cae a estudiante (nunca se otorga de más)', () => {
    expect(SesionAdmin.desde('rey', []).rol).toBe('estudiante')
    expect(SesionAdmin.desde(undefined, []).rol).toBe('estudiante')
  })
})

describe('SesionAdmin · cupo de planes', () => {
  it('cuenta los que quedan y lo dice en palabras', () => {
    const c = admin.cupoEn('uade', 4, LIMITE_UADE)
    expect(c).toMatchObject({ usados: 4, limite: 6 })
    expect(c.disponibles).toBe(2)
    expect(c.puedeCrear).toBe(true)
    expect(c.leyenda).toBe('4 de 6 · podés crear 2 más')
  })

  it('en el límite, no puede crear', () => {
    const c = admin.cupoEn('uade', 6, LIMITE_UADE)
    expect(c.puedeCrear).toBe(false)
    expect(c.leyenda).toBe('6 de 6 · llegaste al límite')
  })

  it('pasado el límite (bajado a mano por el superadmin) no queda en negativo', () => {
    const c = admin.cupoEn('uade', 9, LIMITE_UADE)
    expect(c.disponibles).toBe(0)
    expect(c.puedeCrear).toBe(false)
  })

  it('sin permiso de crear, el cupo lo dice', () => {
    const soloLectura = new SesionAdmin('admin_uni', [hab({ crear: false })])
    const c = soloLectura.cupoEn('uade', 2, LIMITE_UADE)
    expect(c.puedeCrear).toBe(false)
    expect(c.leyenda).toContain('no podés crear planes nuevos')
  })

  it('el superadmin no tiene límite', () => {
    const c = superadmin.cupoEn('uade', 12, LIMITE_UADE)
    expect(c.limite).toBeNull()
    expect(c.disponibles).toBeNull()
    expect(c.puedeCrear).toBe(true)
    expect(c.leyenda).toBe('12 planes · sin límite')
  })

  it('el singular no queda mal escrito', () => {
    expect(superadmin.cupoEn('uade', 1, LIMITE_UADE).leyenda).toBe('1 plan · sin límite')
  })

  // Regresión de la corrección 1 (migración 006). Antes `limite_planes` vivía en la fila
  // de `admin_uni`, así que dos admins de la misma universidad con límites distintos
  // daban cupos distintos para LA MISMA facultad y el resultado dependía de quién
  // apretaba el botón. Ahora el número entra por afuera y es uno solo.
  it('el cupo es de la universidad: dos admins distintos ven lo mismo', () => {
    const ana = new SesionAdmin('admin_uni', [hab()])
    const beto = new SesionAdmin('admin_uni', [hab({ eliminar: true })])
    expect(ana.cupoEn('uade', 4, LIMITE_UADE).leyenda).toBe(
      beto.cupoEn('uade', 4, LIMITE_UADE).leyenda,
    )
  })
})

describe('PlanAdmin · cómo se muestra un plan en la lista', () => {
  const plan = (over: Partial<ConstructorParameters<typeof PlanAdmin>[0]> = {}) =>
    new PlanAdmin({
      id: 'p',
      universidad_id: 'uade',
      codigo: '1621',
      anio: 2021,
      carrera: 'Ingeniería',
      estado: 'publicado',
      version_publicada: 3,
      actualizado_at: null,
      publicado_at: null,
      ...over,
    })

  it('publicado dice qué versión ve el alumno', () => {
    expect(plan().etiquetaEstado).toBe('Publicado · v3')
    expect(plan().visible).toBe(true)
  })

  it('sin foto publicada, el alumno no lo ve', () => {
    expect(plan({ version_publicada: null }).etiquetaEstado).toBe('Sin publicar')
    expect(plan({ estado: 'borrador', version_publicada: null }).etiquetaEstado).toBe('Sin publicar')
    expect(plan({ version_publicada: null }).visible).toBe(false)
  })

  it('detecta borrador con cambios sin publicar', () => {
    const con = plan({ actualizado_at: '2026-08-09T12:00:00Z', publicado_at: '2026-08-08T12:00:00Z' })
    const sin = plan({ actualizado_at: '2026-08-08T12:00:00Z', publicado_at: '2026-08-09T12:00:00Z' })
    expect(con.tieneCambiosSinPublicar).toBe(true)
    expect(sin.tieneCambiosSinPublicar).toBe(false)
  })

  it('publicar toca la fila del plan: no cuenta como cambio pendiente', () => {
    // los dos sellos quedan a milisegundos, dentro de la tolerancia
    const p = plan({ actualizado_at: '2026-08-08T12:00:01Z', publicado_at: '2026-08-08T12:00:00Z' })
    expect(p.tieneCambiosSinPublicar).toBe(false)
  })

  it('nunca publicado con borrador editado: sí tiene cambios', () => {
    expect(plan({ actualizado_at: '2026-08-08T12:00:00Z' }).tieneCambiosSinPublicar).toBe(true)
  })

  it('se arma desde la fila de la base y descarta lo que no cierra', () => {
    expect(PlanAdmin.desde({ id: 'p', universidad_id: 'uade' })?.estado).toBe('borrador')
    expect(PlanAdmin.desde({ universidad_id: 'uade' })).toBeNull()
    expect(PlanAdmin.desde(null)).toBeNull()
  })
})

describe('PlanNuevo · crear un plan', () => {
  const nuevo = (over: Partial<ConstructorParameters<typeof PlanNuevo>[0]> = {}) =>
    new PlanNuevo({ universidad: 'uade', carrera: 'Ing.', codigo: '1621', anio: 2021, ...over })

  it('el slug saca acentos, símbolos y mayúsculas', () => {
    expect(PlanNuevo.slug('Ingeniería en Informática')).toBe('ingenieria-en-informatica')
    expect(PlanNuevo.slug('Lic. en Gestión de TI (2021)')).toBe('lic-en-gestion-de-ti-2021')
    expect(PlanNuevo.slug('  ¿Qué?  ')).toBe('que')
  })

  it('el id sugerido combina universidad y carrera', () => {
    expect(nuevo({ carrera: 'Ingeniería en Informática' }).idSugerido([])).toBe(
      'uade-ingenieria-en-informatica',
    )
  })

  it('si el id ya existe, no falla: numera', () => {
    const p = nuevo({ carrera: 'Análisis de Sistemas' })
    const existentes = ['uade-analisis-de-sistemas']
    expect(p.idSugerido(existentes)).toBe('uade-analisis-de-sistemas-2')
    expect(p.idSugerido([...existentes, 'uade-analisis-de-sistemas-2'])).toBe(
      'uade-analisis-de-sistemas-3',
    )
  })

  it('nunca devuelve un id vacío', () => {
    expect(nuevo({ universidad: '', carrera: '' }).idSugerido([])).toBe('plan')
  })

  it('un formulario completo no tiene problemas', () => {
    expect(nuevo().problemas(2026)).toEqual([])
    expect(nuevo().listo(2026)).toBe(true)
  })

  it('dice todo lo que falta, no solo lo primero', () => {
    const p = nuevo({ universidad: '', carrera: '  ', codigo: '', anio: 0 }).problemas(2026)
    expect(p).toHaveLength(4)
    expect(p[0]).toContain('universidad')
    expect(p[3]).toContain('1950')
  })

  it('acota el año a algo plausible (un dedazo no pasa)', () => {
    expect(nuevo({ anio: 1800 }).problemas(2026)).toHaveLength(1)
    expect(nuevo({ anio: 2100 }).problemas(2026)).toHaveLength(1)
    expect(nuevo({ anio: 2031 }).problemas(2026)).toEqual([]) // +5 entra
  })
})

describe('UniversidadNueva · el Gate C empieza acá', () => {
  // El id de la universidad es el PREFIJO del id de cada uno de sus planes, así que un
  // nombre largo se propaga a todo. Sin la sigla, el Gate C terminaba con planes
  // llamados `universidad-tecnologica-nacional-ingenieria-en-sistemas-de-informacion`.
  it('sugiere la sigla cuando el nombre es largo, y el slug cuando es corto', () => {
    expect(new UniversidadNueva('Universidad Tecnológica Nacional').id).toBe('utn')
    expect(new UniversidadNueva('Universidad de Buenos Aires').id).toBe('uba') // "de" no cuenta
    expect(new UniversidadNueva('UADE').id).toBe('uade')
    expect(new UniversidadNueva('Instituto Balseiro').id).toBe('instituto-balseiro')
  })

  it('el id se puede elegir a mano, que es la única oportunidad de hacerlo', () => {
    expect(new UniversidadNueva('Universidad Tecnológica Nacional', 5, 'utn-frba').id).toBe(
      'utn-frba',
    )
  })

  it('un id escrito a mano tiene que ser un slug válido', () => {
    const malo = new UniversidadNueva('UTN', 5, 'UTN FRBA!').problemas([])
    expect(malo[0]).toContain('minúsculas')
  })

  it('una universidad completa no tiene problemas', () => {
    expect(new UniversidadNueva('UNLP', 8).problemas([])).toEqual([])
    expect(new UniversidadNueva('UNLP', 8).listo([])).toBe(true)
  })

  it('rechaza el nombre vacío', () => {
    expect(new UniversidadNueva('   ').problemas([])[0]).toContain('nombre')
  })

  it('rechaza un nombre que no deja ni una letra en el slug', () => {
    expect(new UniversidadNueva('¿¿¿ !!!').problemas([])[0]).toContain('al menos una letra')
  })

  it('no deja pisar una universidad que ya existe', () => {
    const p = new UniversidadNueva('UADE').problemas(['uade'])
    expect(p).toHaveLength(1)
    expect(p[0]).toContain('uade')
  })

  it('valida el id de un plan escrito a mano', () => {
    expect(PlanNuevo.problemasDeId('uade-ing', [])).toEqual([])
    expect(PlanNuevo.problemasDeId('  ', [])[0]).toContain('vacío')
    expect(PlanNuevo.problemasDeId('UADE Ing', [])[0]).toContain('minúsculas')
    expect(PlanNuevo.problemasDeId('uade-ing', ['uade-ing'])[0]).toContain('ya está en uso')
  })

  it('el límite tiene que ser un entero de 1 o más', () => {
    expect(new UniversidadNueva('X', 0).problemas([])).toHaveLength(1)
    expect(new UniversidadNueva('X', 1.5).problemas([])).toHaveLength(1)
    expect(new UniversidadNueva('X', 1).problemas([])).toEqual([])
  })
})
