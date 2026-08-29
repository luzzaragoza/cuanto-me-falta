// Validador de planes de estudio — la red de seguridad de los DATOS.
//
// Nació como tests de integridad sobre los planes que viajan en el bundle
// (`src/data/integrity.test.ts`). Con la carga de planes en el backend, los mismos
// invariantes tienen que valer en TRES lugares:
//
//   1. CI          — ningún plan del repo se publica roto (los tests lo llaman por plan).
//   2. El editor   — un plan no se puede PUBLICAR con errores (y los avisos se muestran).
//   3. El arranque — un plan que llega del backend o del caché se descarta si está roto,
//                    antes de que la app lo dibuje.
//
// Por eso vive acá y es PURO: entra un `PlanDef`, sale una lista de hallazgos. Sin
// dependencias, sin I/O, sin throw. Duplicar esta lógica en la UI sería la forma
// garantizada de que las tres copias se desincronicen.
//
// La base de datos hace cumplir aparte un subconjunto de esto con constraints
// (claves compuestas y FKs) — defensa en profundidad: el validador da mensajes
// entendibles, las constraints impiden el dato imposible incluso vía API.

import type { PlanDef } from '../data/model'

/** Un error impide publicar; un aviso es algo raro que conviene mirar. */
export type Severidad = 'error' | 'aviso'

/** Qué invariante se rompió. Sirve al editor para agrupar y para los tests. */
export type Regla =
  | 'plan-incompleto'
  | 'materia-invalida'
  | 'materia-duplicada'
  | 'nombre-duplicado'
  | 'correlativa-inexistente'
  | 'auto-correlativa'
  | 'correlativa-duplicada'
  | 'ciclo'
  | 'correlativa-no-anterior'
  | 'optativa-en-correlativas'
  | 'titulo-invalido'
  | 'sin-titulos'
  | 'anio-sin-materias'

export interface Hallazgo {
  regla: Regla
  severidad: Severidad
  /** Mensaje en español, listo para mostrarle a quien carga el plan. */
  mensaje: string
  /** Materias involucradas — el editor las resalta. */
  cods: string[]
}

const vacio = (s: string | undefined): boolean => !s || !s.trim()

/**
 * Cómo se nombra una materia en los mensajes: el nombre, con el código al lado.
 *
 * Los avisos decían solo el código (`3.4.071 ← 3.4.069`) y eso únicamente lo entiende
 * quien ya se sabe el plan de memoria. Va el nombre para poder leerlo, y el código para
 * poder encontrarlo en la grilla.
 */
function comoSeLlama(plan: PlanDef, cod: string): string {
  const m = plan.materias.find((x) => x.cod === cod)
  return m?.nom?.trim() ? `${m.nom} (${cod})` : cod
}

/**
 * Valida un plan completo. Devuelve TODOS los hallazgos (errores y avisos), en orden
 * de lectura: primero lo estructural, después las correlativas, al final los títulos.
 */
function revisar(plan: PlanDef): Hallazgo[] {
  const h: Hallazgo[] = []
  const err = (regla: Regla, mensaje: string, cods: string[] = []): void => {
    h.push({ regla, severidad: 'error', mensaje, cods })
  }
  const aviso = (regla: Regla, mensaje: string, cods: string[] = []): void => {
    h.push({ regla, severidad: 'aviso', mensaje, cods })
  }

  // ── 1. Cabecera y estructura ────────────────────────────────────────────
  const faltan: string[] = []
  if (vacio(plan.id)) faltan.push('id')
  if (vacio(plan.universidad)) faltan.push('universidad')
  if (vacio(plan.codigo)) faltan.push('código de plan')
  if (vacio(plan.carrera)) faltan.push('nombre de la carrera')
  if (!Number.isInteger(plan.anio) || plan.anio < 1900) faltan.push('año de vigencia')
  if (faltan.length) err('plan-incompleto', `Faltan datos del plan: ${faltan.join(', ')}.`)
  if (plan.materias.length === 0) {
    err('plan-incompleto', 'El plan no tiene ninguna materia.')
    return h // sin materias, el resto de las reglas no dice nada útil
  }

  for (const m of plan.materias) {
    const problemas: string[] = []
    if (vacio(m.cod)) problemas.push('sin código')
    if (vacio(m.nom)) problemas.push('sin nombre')
    if (!Number.isInteger(m.anio) || m.anio < 1) problemas.push(`año inválido (${m.anio})`)
    if (m.cuatri !== 1 && m.cuatri !== 2) problemas.push(`cuatrimestre inválido (${m.cuatri})`)
    if (problemas.length) {
      const quien = vacio(m.cod) ? (m.nom || '(materia sin datos)') : m.cod
      err('materia-invalida', `${quien}: ${problemas.join(', ')}.`, vacio(m.cod) ? [] : [m.cod])
    }
  }

  const vistas = new Set<string>()
  for (const m of plan.materias) {
    if (vistas.has(m.cod)) {
      err('materia-duplicada', `El código ${m.cod} está cargado más de una vez.`, [m.cod])
    }
    vistas.add(m.cod)
  }

  const porNombre = new Map<string, string[]>()
  for (const m of plan.materias) {
    const k = m.nom.trim().toLocaleLowerCase('es')
    if (!k) continue
    porNombre.set(k, [...(porNombre.get(k) ?? []), m.cod])
  }
  for (const [, cods] of porNombre) {
    if (cods.length > 1) {
      aviso(
        'nombre-duplicado',
        `Hay ${cods.length} materias con el mismo nombre (${cods.join(', ')}). Puede ser correcto (mismo nombre en cuatrimestres distintos), pero conviene revisarlo.`,
        cods,
      )
    }
  }

  const anios = [...new Set(plan.materias.map((m) => m.anio))].sort((a, b) => a - b)
  for (let a = anios[0]; a < anios[anios.length - 1]; a++) {
    if (!anios.includes(a)) {
      aviso('anio-sin-materias', `El plan salta el ${a}° año: no tiene ninguna materia.`)
    }
  }

  // ── 2. Correlativas ─────────────────────────────────────────────────────
  const codigos = new Set(plan.materias.map((m) => m.cod))
  const idx = new Map(plan.materias.map((m) => [m.cod, m.indice]))
  const opts = new Set(plan.materias.filter((m) => m.opt).map((m) => m.cod))

  const parejas = new Set<string>()
  for (const c of plan.correlativas) {
    const existen = codigos.has(c.cod) && codigos.has(c.requiere)
    if (!existen) {
      const cuál = !codigos.has(c.cod) ? c.cod : c.requiere
      err(
        'correlativa-inexistente',
        `${comoSeLlama(plan, c.cod)} pide ${cuál}, que no existe en el plan.`,
        [c.cod, c.requiere],
      )
      continue
    }
    if (c.cod === c.requiere) {
      err(
        'auto-correlativa',
        `${comoSeLlama(plan, c.cod)} figura como correlativa de sí misma.`,
        [c.cod],
      )
      continue
    }
    const k = `${c.cod}<-${c.requiere}`
    if (parejas.has(k)) {
      err(
        'correlativa-duplicada',
        `${comoSeLlama(plan, c.cod)} tiene dos veces la misma previa: ${comoSeLlama(plan, c.requiere)}.`,
        [c.cod, c.requiere],
      )
      continue
    }
    parejas.add(k)

    // Invariante del árbol (una fila por cuatrimestre): la previa vive SIEMPRE más
    // arriba, así toda flecha fluye hacia abajo. Un plan que lo rompa no es cursable
    // tal como está cargado (pedirían la materia y su previa en el mismo cuatrimestre).
    if (idx.get(c.requiere)! >= idx.get(c.cod)!) {
      err(
        'correlativa-no-anterior',
        `${comoSeLlama(plan, c.cod)} pide ${comoSeLlama(plan, c.requiere)}, que no está en un cuatrimestre anterior. Revisá el año o el cuatrimestre de alguna de las dos.`,
        [c.cod, c.requiere],
      )
    }

    // RN-05: las optativas se habilitan por la oferta anual, no por correlativas.
    //
    // Se evaluó relajarlo a aviso (12-ago), porque hay universidades que sí encadenan sus
    // optativas. Se descartó por una razón concreta del lado del ALUMNO: `StatePopover`
    // exime a las optativas del aviso de previas —una optativa es un slot que el alumno
    // renombra, así que no sabemos cuál eligió—, con lo cual un plan con optativas
    // encadenadas cargaría bien pero al alumno nunca se le avisarían esas previas. Mejor
    // una regla dura y honesta que una que se cumple a medias. Si alguna universidad lo
    // necesita, se revisa junto con esa exención.
    if (opts.has(c.cod) || opts.has(c.requiere)) {
      err(
        'optativa-en-correlativas',
        `${comoSeLlama(plan, c.cod)} y ${comoSeLlama(plan, c.requiere)}: una de las dos es optativa, y las optativas no participan de las correlativas.`,
        [c.cod, c.requiere],
      )
    }
  }

  for (const ciclo of buscarCiclos(plan)) {
    err('ciclo', `Las correlativas forman un círculo: ${ciclo.join(' → ')}.`, ciclo)
  }

  // ── 3. Títulos ──────────────────────────────────────────────────────────
  const cuatris = new Set(plan.materias.map((m) => `${m.anio}.${m.cuatri}`))
  for (const t of plan.titulos) {
    if (vacio(t.nombre)) {
      err('titulo-invalido', 'Hay un título sin nombre.')
      continue
    }
    if (!anios.includes(t.hastaAnio)) {
      err(
        'titulo-invalido',
        `El título "${t.nombre}" se otorga hasta ${t.hastaAnio}° año, y el plan no tiene materias de ese año.`,
      )
      continue
    }
    if (t.hastaCuatri != null && !cuatris.has(`${t.hastaAnio}.${t.hastaCuatri}`)) {
      err(
        'titulo-invalido',
        `El título "${t.nombre}" se otorga hasta ${t.hastaAnio}°/${t.hastaCuatri}°C, y el plan no tiene materias en ese cuatrimestre.`,
      )
    }
  }
  if (plan.titulos.length === 0) {
    aviso('sin-titulos', 'El plan no otorga ningún título. Se puede publicar igual.')
  }

  return h
}

/**
 * El resultado de revisar un plan: los hallazgos y las preguntas que se les hacen.
 *
 * Es un objeto y no tres funciones sueltas porque las tres —"¿qué encontraste?",
 * "¿cuáles bloquean?", "¿se puede publicar?"— son preguntas sobre EL MISMO análisis,
 * y antes cada una lo recalculaba desde cero: `esPublicable` llamaba a `erroresDe`, que
 * llamaba a `validarPlan`. Acá se revisa una vez, en el constructor.
 */
export class Validacion {
  readonly hallazgos: readonly Hallazgo[]

  constructor(plan: PlanDef) {
    this.hallazgos = revisar(plan)
  }

  /** Lo que impide publicar. */
  get errores(): Hallazgo[] {
    return this.hallazgos.filter((x) => x.severidad === 'error')
  }

  /** Lo raro que conviene mirar, pero no bloquea. */
  get avisos(): Hallazgo[] {
    return this.hallazgos.filter((x) => x.severidad === 'aviso')
  }

  /** ¿Se puede publicar? (no tiene errores; los avisos no bloquean) */
  get esPublicable(): boolean {
    return !this.hallazgos.some((x) => x.severidad === 'error')
  }

  /** Las reglas disparadas, en orden. Atajo para los tests. */
  get reglas(): Regla[] {
    return this.hallazgos.map((x) => x.regla)
  }
}

/**
 * Ciclos en el grafo de correlativas, por DFS con marcas (blanco/gris/negro).
 * Devuelve el camino de cada ciclo encontrado, cerrado sobre sí mismo.
 */
function buscarCiclos(plan: PlanDef): string[][] {
  const ady = new Map<string, string[]>()
  for (const c of plan.correlativas) {
    if (c.cod === c.requiere) continue // ya reportado como auto-correlativa
    ady.set(c.cod, [...(ady.get(c.cod) ?? []), c.requiere])
  }
  const marca = new Map<string, 'proceso' | 'listo'>()
  const ciclos: string[][] = []
  const visitar = (cod: string, camino: string[]): void => {
    marca.set(cod, 'proceso')
    for (const previa of ady.get(cod) ?? []) {
      if (marca.get(previa) === 'proceso') ciclos.push([...camino, cod, previa])
      else if (!marca.has(previa)) visitar(previa, [...camino, cod])
    }
    marca.set(cod, 'listo')
  }
  for (const cod of ady.keys()) if (!marca.has(cod)) visitar(cod, [])
  return ciclos
}
