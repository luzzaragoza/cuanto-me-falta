// Modelo de datos NORMALIZADO de los planes de estudio.
//
// Pensado como la "base de datos del día de mañana": cada interfaz mapea 1:1 a una
// tabla del futuro backend. Hoy vive como datos en TS; cuando haya servidor + rol
// admin, el admin carga estas mismas entidades (universidades, planes, materias,
// correlativas, títulos) y esto pasa a JSON / filas de una DB sin cambiar el dominio.
//
//   universidad 1───N plan 1───N materia
//                          plan 1───N correlativa   (materia → requiere materia)
//                          plan 1───N titulo         (hito al completar hasta cierto año)

/** Una universidad. Tabla `universidad`. */
export interface Universidad {
  id: string // slug estable, ej. 'uade'
  nombre: string // 'UADE'
}

/** Una materia dentro de un plan. Tabla `materia`. El `cod` puede repetirse ENTRE planes. */
export interface MateriaPlan {
  cod: string // código UADE, ej. '3.4.069'
  nom: string // nombre de la materia
  anio: number // año de la carrera (1..N)
  cuatri: number // cuatrimestre dentro del año (1 | 2)
  opt?: boolean // optativa: el alumno le pone el nombre (slot renombrable)
  especial?: boolean // se habilita por requisito especial (por año / % de carrera), no por correlativa
}

/** Una correlativa: `cod` necesita `requiere` antes. Tabla `correlativa` (join). */
export interface Correlativa {
  cod: string // la materia
  requiere: string // la que necesita aprobada/en curso antes
}

/** Un título que otorga el plan al completar todas las materias hasta `hastaAnio`. Tabla `titulo`. */
export interface TituloPlan {
  nombre: string // 'Analista en Informática'
  hastaAnio: number // se consigue al aprobar todo hasta este año inclusive
}

/** Un plan de estudios (una versión concreta de una carrera). Tabla `plan`. */
export interface PlanDef {
  id: string // slug estable, ej. 'uade-ing-informatica'
  universidad: string // FK → Universidad.id
  codigo: string // código del plan en la facu, ej. '1621'
  anio: number // año de vigencia del plan, ej. 2021
  carrera: string // nombre de la carrera, ej. 'Ingeniería en Informática'
  materias: MateriaPlan[]
  correlativas: Correlativa[]
  titulos: TituloPlan[]
}
