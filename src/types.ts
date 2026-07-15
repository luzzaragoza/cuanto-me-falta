// Tipos compartidos del dominio.

/** Estado de una materia. Es obligatorio; la nota es aparte y opcional. */
export type Estado = 'pendiente' | 'cursando' | 'final' | 'aprobada'

/** Una materia tal como viene en el plan (dato estático). */
export interface MateriaDef {
  cod: string
  nom: string
}

/** Un cuatrimestre dentro de un año. Puede otorgar un título si el hito cae a mitad de año. */
export interface CuatriDef {
  n: number
  titulo?: string
  mats: MateriaDef[]
}

/** Un año del plan. Algunos otorgan un título al completarse. */
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

/**
 * Avance "espejado" desde las OTRAS carreras del usuario: para cada materia
 * compartida (mismo código en la misma universidad), el mejor estado y su nota
 * registrados en otro plan. Es DERIVADO y de solo lectura: el Store lo pone
 * DEBAJO de las marcas propias al armar el snapshot que ve la UI, pero nunca
 * se persiste (cada plan sigue guardando únicamente lo suyo).
 */
export interface Espejo {
  states: Record<string, Estado>
  notas: Record<string, number>
}

/** Todo el estado del usuario que persiste en el navegador. */
export interface DB {
  states: Record<string, Estado>
  notas: Record<string, number>
  optNames: Record<string, string>
  custom: MateriaCustom[]
  profile?: Perfil
}
