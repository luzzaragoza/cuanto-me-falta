// El borrador de un plan mientras se edita — la parte PURA del editor.
//
// La UI tiene un `Borrador` en memoria y lo transforma con estas funciones; el guardado
// va aparte (`state/admin.ts`), acción por acción, para no mandar el plan entero en cada
// tecla. Todo acá es inmutable: entra un borrador, sale otro. Así se testea sin backend
// y la UI no tiene lógica de dominio escondida entre los componentes.
//
// La conversión a `PlanDef` (`aPlanDef`) es la bisagra: con ella el mismo borrador
// alimenta el validador que ya existe Y el árbol de correlativas, sin código nuevo.

import type { MateriaPlan, PlanDef, TituloPlan } from '../data/model'
import { indiceCuatri } from './validarPlan'

/** Una materia en edición. `nueva` = todavía no existe en la base. */
export interface MateriaEdit {
  cod: string
  nom: string
  anio: number
  cuatri: number
  opt: boolean
  especial: boolean
  orden: number
  nueva?: boolean
  /** Código con el que está guardada en la base (para poder renombrar el código). */
  codOriginal?: string
}

export interface Correlativa {
  cod: string
  requiere: string
}

export interface Borrador {
  id: string
  universidad: string
  codigo: string
  anio: number
  carrera: string
  materias: MateriaEdit[]
  correlativas: Correlativa[]
  titulos: TituloPlan[]
}

/** Orden de lectura: por año, cuatrimestre y el orden dentro del cuatrimestre. */
export function ordenar(materias: MateriaEdit[]): MateriaEdit[] {
  return [...materias].sort(
    (a, b) => a.anio - b.anio || a.cuatri - b.cuatri || a.orden - b.orden || a.cod.localeCompare(b.cod),
  )
}

/**
 * El borrador como `PlanDef`: lo que come el validador y el árbol. Las materias sin
 * código quedan afuera (son filas recién agregadas que todavía no se pueden guardar) y
 * con ellas sus correlativas, para no inventar referencias colgadas.
 */
export function aPlanDef(b: Borrador): PlanDef {
  const materias: MateriaPlan[] = ordenar(b.materias)
    .filter((m) => m.cod.trim() !== '')
    .map((m) => ({
      cod: m.cod.trim(),
      nom: m.nom.trim(),
      anio: m.anio,
      cuatri: m.cuatri,
      ...(m.opt ? { opt: true } : {}),
      ...(m.especial ? { especial: true } : {}),
    }))
  const existentes = new Set(materias.map((m) => m.cod))
  return {
    id: b.id,
    universidad: b.universidad,
    codigo: b.codigo,
    anio: b.anio,
    carrera: b.carrera,
    materias,
    correlativas: b.correlativas.filter((c) => existentes.has(c.cod) && existentes.has(c.requiere)),
    titulos: b.titulos,
  }
}

/** Materias que PUEDEN ser previa de `cod`: cuatrimestre anterior y no optativas. */
export function elegiblesComoPrevia(b: Borrador, cod: string): MateriaEdit[] {
  const yo = b.materias.find((m) => m.cod === cod)
  if (!yo) return []
  const miIndice = indiceCuatri(yo.anio, yo.cuatri)
  return ordenar(
    b.materias.filter(
      (m) =>
        m.cod !== cod &&
        m.cod.trim() !== '' &&
        !m.opt &&
        indiceCuatri(m.anio, m.cuatri) < miIndice,
    ),
  )
}

/**
 * Materias que pueden tener a `cod` COMO previa: cuatrimestre posterior y no optativas.
 * Es la dirección inversa de `elegiblesComoPrevia`, y existe porque cargar un plan se lee
 * en los dos sentidos: "esta necesita…" o "esta habilita…".
 */
export function elegiblesComoPosterior(b: Borrador, cod: string): MateriaEdit[] {
  const yo = b.materias.find((m) => m.cod === cod)
  if (!yo || yo.opt) return [] // una optativa no habilita nada (RN-05)
  const miIndice = indiceCuatri(yo.anio, yo.cuatri)
  return ordenar(
    b.materias.filter(
      (m) =>
        m.cod !== cod && m.cod.trim() !== '' && !m.opt && indiceCuatri(m.anio, m.cuatri) > miIndice,
    ),
  )
}

/** Códigos que `cod` requiere hoy. */
export function previasDe(b: Borrador, cod: string): string[] {
  return b.correlativas.filter((c) => c.cod === cod).map((c) => c.requiere)
}

/** Materias que se habilitan con `cod` (para avisar antes de borrarla). */
export function dependenDe(b: Borrador, cod: string): string[] {
  return b.correlativas.filter((c) => c.requiere === cod).map((c) => c.cod)
}

/** Pone o saca una previa. No valida: las elegibles ya vienen filtradas. */
export function alternarPrevia(b: Borrador, cod: string, requiere: string): Borrador {
  const existe = b.correlativas.some((c) => c.cod === cod && c.requiere === requiere)
  return {
    ...b,
    correlativas: existe
      ? b.correlativas.filter((c) => !(c.cod === cod && c.requiere === requiere))
      : [...b.correlativas, { cod, requiere }],
  }
}

/** ¿Ya existe ese código en el plan? (ignorando a la propia materia) */
export function codigoRepetido(b: Borrador, cod: string, exceptoOrden: number): boolean {
  const limpio = cod.trim()
  if (!limpio) return false
  return b.materias.some((m) => m.orden !== exceptoOrden && m.cod.trim() === limpio)
}

/** ¿La fila tiene lo mínimo para poder guardarse? */
export function guardable(m: MateriaEdit): boolean {
  return m.cod.trim() !== '' && m.nom.trim() !== ''
}

/** Agrega una fila vacía al final de ese cuatrimestre. Devuelve el borrador y su `orden`. */
export function agregarMateria(
  b: Borrador,
  anio: number,
  cuatri: number,
): { borrador: Borrador; orden: number } {
  const orden = b.materias.reduce((max, m) => Math.max(max, m.orden), -1) + 1
  const nueva: MateriaEdit = {
    cod: '',
    nom: '',
    anio,
    cuatri,
    opt: false,
    especial: false,
    orden,
    nueva: true,
  }
  return { borrador: { ...b, materias: [...b.materias, nueva] }, orden }
}

/** Cambia campos de una materia, identificada por su `orden` (estable aunque cambie el código). */
export function editarMateria(
  b: Borrador,
  orden: number,
  campos: Partial<Omit<MateriaEdit, 'orden'>>,
): Borrador {
  return {
    ...b,
    materias: b.materias.map((m) => (m.orden === orden ? { ...m, ...campos } : m)),
  }
}

/**
 * Saca una materia y TODAS sus correlativas (en los dos sentidos). Sin esto quedarían
 * referencias a un código que ya no existe — que es justo lo que el validador rechaza.
 */
export function quitarMateria(b: Borrador, orden: number): Borrador {
  const m = b.materias.find((x) => x.orden === orden)
  if (!m) return b
  const cod = m.cod.trim()
  return {
    ...b,
    materias: b.materias.filter((x) => x.orden !== orden),
    correlativas: cod
      ? b.correlativas.filter((c) => c.cod !== cod && c.requiere !== cod)
      : b.correlativas,
  }
}

/**
 * Renombrar el CÓDIGO de una materia arrastra sus correlativas: si no, cambiar un código
 * mal tipeado dejaría el grafo apuntando al viejo.
 */
export function renombrarCodigo(b: Borrador, orden: number, nuevo: string): Borrador {
  const m = b.materias.find((x) => x.orden === orden)
  if (!m) return b
  const viejo = m.cod.trim()
  const limpio = nuevo.trim()
  const conCodigo = editarMateria(b, orden, { cod: nuevo })
  if (!viejo || !limpio || viejo === limpio) return conCodigo
  return {
    ...conCodigo,
    correlativas: conCodigo.correlativas.map((c) => ({
      cod: c.cod === viejo ? limpio : c.cod,
      requiere: c.requiere === viejo ? limpio : c.requiere,
    })),
  }
}

/**
 * Mover una materia a otro cuatrimestre puede volver imposibles algunas correlativas
 * (una previa que ahora queda en el mismo cuatrimestre o después). Devuelve el borrador
 * movido y las correlativas que quedaron mal, para avisar ANTES de guardar.
 */
export function moverMateria(
  b: Borrador,
  orden: number,
  anio: number,
  cuatri: number,
): { borrador: Borrador; rotas: Correlativa[] } {
  const movido = editarMateria(b, orden, { anio, cuatri })
  const idx = new Map(
    movido.materias.filter((m) => m.cod.trim()).map((m) => [m.cod.trim(), indiceCuatri(m.anio, m.cuatri)]),
  )
  const rotas = movido.correlativas.filter((c) => {
    const a = idx.get(c.cod)
    const r = idx.get(c.requiere)
    return a !== undefined && r !== undefined && r >= a
  })
  return { borrador: movido, rotas }
}

/** Años que el plan tiene con materias, en orden. */
export function aniosDe(b: Borrador): number[] {
  return [...new Set(b.materias.map((m) => m.anio))].sort((a, z) => a - z)
}

/** Cuenta lo que hay, para el encabezado del editor. */
export function resumen(b: Borrador): { materias: number; correlativas: number; titulos: number } {
  return {
    materias: b.materias.filter((m) => m.cod.trim() !== '').length,
    correlativas: b.correlativas.length,
    titulos: b.titulos.length,
  }
}
