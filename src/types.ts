// Tipos compartidos del dominio.

/** Estado de una materia. Es obligatorio; la nota es aparte y opcional. */
export type Estado = 'pendiente' | 'cursando' | 'final' | 'aprobada'

/** Una materia tal como viene en el plan (dato estático). */
export interface MateriaDef {
  cod: string
  nom: string
}

/** Un cuatrimestre dentro de un año. */
export interface CuatriDef {
  n: number
  mats: MateriaDef[]
}

/** Un año del plan. Algunos otorgan un título intermedio. */
export interface AnioDef {
  year: number
  titulo?: string
  cuatris: CuatriDef[]
}

/** Materia agregada a mano por el usuario (slot custom). */
export interface MateriaCustom {
  cod: string
  nom: string
  y: number
  c: number
}

/** Perfil del usuario (queda solo en el navegador). */
export interface Perfil {
  name: string
  photo: string
}

/** Todo el estado del usuario que persiste en el navegador. */
export interface DB {
  states: Record<string, Estado>
  notas: Record<string, number>
  optNames: Record<string, string>
  custom: MateriaCustom[]
  profile?: Perfil
}
