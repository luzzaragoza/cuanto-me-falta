// La FORMA del JSON que entra y sale. Esto NO es el dominio.
//
// El dominio son las clases de `model.ts`. Acá se describe el *sobre*: exactamente el
// mismo idioma que hablan los tres lugares de donde salen los planes —
//
//   · los módulos del bundle (`data/planes/*.ts`), que son literales;
//   · la vista `plan_publicado` de Supabase, que devuelve un plan por fila en jsonb;
//   · el caché de localStorage, que es lo anterior pasado por `JSON.stringify`.
//
// Los tres coinciden a propósito (el `jsonb_strip_nulls` de la vista existe justo para
// eso), y `PlanDef.desde()` es el ÚNICO lugar donde ese idioma se traduce a objetos.
//
// Por qué esto son tipos y no clases: describe DATOS EN TRÁNSITO, no objetos con
// conducta. `JSON.parse` devuelve esta forma y nada más; el objeto nace después, en la
// factory. Darle métodos a un sobre sería mentir sobre lo que llega por el cable.

/** Una materia tal como viaja. `opt`/`especial` van solo cuando son `true`. */
export interface MateriaJSON {
  cod: string
  nom: string
  anio: number
  cuatri: number
  opt?: boolean
  especial?: boolean
}

/** Una correlativa tal como viaja: `cod` necesita `requiere` antes. */
export interface CorrelativaJSON {
  cod: string
  requiere: string
}

/** Un título tal como viaja. `hastaCuatri` va solo si el hito cae a mitad de año. */
export interface TituloJSON {
  nombre: string
  hastaAnio: number
  hastaCuatri?: number
}

/** Un plan completo tal como viaja. Es la forma que devuelve `plan_publicado`. */
export interface PlanJSON {
  id: string
  universidad: string
  codigo: string
  anio: number
  carrera: string
  materias: MateriaJSON[]
  correlativas: CorrelativaJSON[]
  titulos: TituloJSON[]
}

/** Una universidad tal como viaja. */
export interface UniversidadJSON {
  id: string
  nombre: string
}
