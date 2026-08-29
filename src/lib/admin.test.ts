import { describe, it, expect } from 'vitest'
import { Habilitacion, PlanAdmin, PlanNuevo, SesionAdmin, UniversidadNueva } from './admin'

const hab = () => new Habilitacion('uade')

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

// Tres roles y nada en el medio (decisión de Luz, 12-ago · `supabase/010`). Lo que se
// pregunta es DÓNDE puede alguien, no QUÉ: estar habilitado en una universidad es poder
// crear, editar, publicar y eliminar ahí, hasta el cupo.
describe('SesionAdmin · permisos por universidad', () => {
  it('el admin puede en la suya y en ninguna otra', () => {
    expect(admin.puedeEn('uade')).toBe(true)
    expect(admin.puedeEn('otra')).toBe(false)
  })

  it('estar habilitado es poder TODO ahí adentro: no hay permisos a medias', () => {
    expect(admin.puedeEditar('uade')).toBe(true)
    expect(admin.puedeEliminar('uade')).toBe(true)
    expect(admin.cupoEn('uade', 0, LIMITE_UADE).puedeCrear).toBe(true)
  })

  it('el superadmin puede en cualquier universidad', () => {
    expect(superadmin.puedeEditar('cualquiera')).toBe(true)
    expect(superadmin.puedeEliminar('cualquiera')).toBe(true)
  })

  it('gestionar permisos es lo único exclusivo del superadmin', () => {
    expect(superadmin.puedeGestionarPermisos).toBe(true)
    expect(admin.puedeGestionarPermisos).toBe(false)
    expect(alumno.puedeGestionarPermisos).toBe(false)
  })

  it('habilitacionEn no inventa nada', () => {
    expect(admin.habilitacionEn('uade')?.universidad_id).toBe('uade')
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

  // Ya no existe "habilitado pero sin poder crear": si no podés crear ahí, es porque esa
  // universidad no es tuya. La leyenda tiene que decir eso y no dejar un botón mudo.
  it('en una universidad ajena el cupo lo dice, en vez de callarse', () => {
    const c = admin.cupoEn('otra-uni', 2, LIMITE_UADE)
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
    const beto = new SesionAdmin('admin_uni', [hab()])
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
      tiene_cambios: false,
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

  it('los cambios sin publicar los dice la base, no se deducen acá', () => {
    expect(plan({ tiene_cambios: true }).tieneCambiosSinPublicar).toBe(true)
    expect(plan({ tiene_cambios: false }).tieneCambiosSinPublicar).toBe(false)
  })

  // REGRESIÓN del bug que encontró Luz el 12-ago: los 4 planes de UADE decían "Cambios sin
  // publicar" sin que nadie los tocara. Se comparaba `actualizado_at` contra `publicado_at`,
  // y la migración 004 movió el primero al publicar sin mover el segundo → los cuatro
  // quedaron con un sello posterior al otro PARA SIEMPRE.
  //
  // Este caso es exactamente esa fila: editado un día después de publicado, pero con el
  // contenido idéntico a la foto. Tiene que decir que NO hay cambios.
  it('un sello de edición posterior al de publicación no es un cambio', () => {
    const p = plan({
      actualizado_at: '2026-08-09T12:00:00Z',
      publicado_at: '2026-08-08T12:00:00Z',
      tiene_cambios: false,
    })
    expect(p.tieneCambiosSinPublicar).toBe(false)
  })

  it('se arma desde la fila de la base y descarta lo que no cierra', () => {
    expect(PlanAdmin.desde({ id: 'p', universidad_id: 'uade' })?.estado).toBe('borrador')
    expect(PlanAdmin.desde({ universidad_id: 'uade' })).toBeNull()
    expect(PlanAdmin.desde(null)).toBeNull()
  })

  it('sin el campo de la vista, no inventa una alarma', () => {
    // Si `plan_editable` no trajo `tiene_cambios`, callarse es mejor que avisar de más:
    // el falso positivo permanente es justo lo que se vino a arreglar.
    expect(PlanAdmin.desde({ id: 'p', universidad_id: 'uade' })?.tieneCambiosSinPublicar).toBe(false)
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
