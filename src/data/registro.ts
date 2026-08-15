// Registro de datos académicos: de dónde salen los planes que ve la app.
//
// ESTRATEGIA: snapshot + refresco (ADR-11).
//
//   1. Los planes del repo viajan en el bundle y son el PISO. La app abre sin red,
//      sin sesión y sin backend configurado — como siempre.
//   2. Si hay un caché en localStorage (bajado del backend en una visita anterior),
//      ese gana: se lee de forma SÍNCRONA al importar el módulo, así nadie tiene que
//      esperar nada y los 8 lugares que hacen `import { PLANES }` no cambian.
//   3. El refresco contra el backend corre DESPUÉS, en segundo plano
//      (`src/state/planesRemoto.ts`), y solo escribe el caché: no reemplaza los planes
//      en caliente. Un plan que cambia debajo de un usuario a mitad de sesión es peor
//      que esperar a que vuelva a abrir la app — y esto cambia dos veces al año.
//
// Descartado: hacer el fetch bloqueante al arrancar. Le agrega latencia al 100% de las
// visitas (y rompe el offline de la PWA) por un dato que casi nunca cambia.
//
// `Registro` no conoce Supabase ni la red: solo localStorage y el validador. La parte
// de I/O vive en `state/planesRemoto`.

import { PlanDef, Universidad } from './model'
import { Validacion } from '../lib/validarPlan'

const CACHE_KEY = 'cmf-planes-cache'
/** Subir esto invalida los cachés viejos de todos los dispositivos. */
const CACHE_VERSION = 1

const hayStorage = (): boolean => typeof localStorage !== 'undefined'

/**
 * Serialización estable: ordena las CLAVES de cada objeto pero respeta el orden de los
 * arrays (en un plan, el orden de las materias es dato: es cómo se dibuja). Hace falta
 * porque los módulos TS del bundle y el JSON del backend traen las mismas claves en
 * distinto orden, y sin esto todo plan parecería siempre distinto.
 */
function estable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(estable).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${estable(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

/** El conjunto de datos académicos que la app tiene cargado: universidades y planes. */
export class Registro {
  readonly universidades: readonly Universidad[]
  readonly planes: readonly PlanDef[]

  constructor(universidades: readonly Universidad[], planes: readonly PlanDef[]) {
    this.universidades = universidades
    this.planes = planes
  }

  static vacio(): Registro {
    return new Registro([], [])
  }

  get hayPlanes(): boolean {
    return this.planes.length > 0
  }

  plan(id: string): PlanDef | undefined {
    return this.planes.find((p) => p.id === id)
  }

  nombreUniversidad(id: string): string {
    return this.universidades.find((u) => u.id === id)?.nombre ?? id
  }

  /**
   * Descarta lo que no se puede dibujar: planes que no pasan el validador y
   * universidades sin id. Un plan roto en el caché o en el backend NO llega a la UI
   * (mejor mostrar 3 carreras que una con las correlativas en círculo).
   */
  saneado(): Registro {
    const planes = this.planes.filter((p) => {
      const v = new Validacion(p)
      if (v.esPublicable) return true
      if (import.meta.env.DEV) {
        console.warn(
          `[planes] descarto "${p.carrera}" (${p.id}): ${v.errores.map((e) => e.mensaje).join(' · ')}`,
        )
      }
      return false
    })
    const universidades = this.universidades.filter((u) => !!u.id && !!u.nombre)
    return new Registro(universidades, planes)
  }

  /** La forma canónica: el JSON del cable, no las instancias. */
  private comoJSON(): unknown {
    return {
      universidades: this.universidades.map((u) => u.aJSON()),
      planes: this.planes.map((p) => p.aJSON()),
    }
  }

  /**
   * ¿Tiene los mismos datos que el otro? (para no reescribir el caché al vicio)
   * Se comparan las formas CANÓNICAS: así el bundle y el backend, que arman sus objetos
   * por caminos distintos, dicen lo mismo cuando los datos son los mismos.
   */
  igualA(otro: Registro): boolean {
    return estable(this.comoJSON()) === estable(otro.comoJSON())
  }

  // ── El caché ────────────────────────────────────────────────────────────

  /**
   * Caché del backend, o `null` si no hay, está vencido de versión o quedó ilegible.
   *
   * ⚠️ Acá está la frontera más peligrosa del modelo: `JSON.parse` devuelve objetos
   * PLANOS, no instancias. Sin `PlanDef.desde()` el caché entraría igual,
   * `JSON.stringify` seguiría andando y el primer método que se llame explota — o peor,
   * no explota y devuelve `undefined`. Todo lo que sale de acá pasa por la factory, y lo
   * que no cierra se descarta (un caché viejo no puede tumbar la app: para eso está el
   * bundle).
   */
  static leerCache(): Registro | null {
    if (!hayStorage()) return null
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return null
      const c = JSON.parse(raw) as { v?: number; planes?: unknown; universidades?: unknown }
      if (c?.v !== CACHE_VERSION || !Array.isArray(c.planes) || !Array.isArray(c.universidades)) {
        return null
      }
      const planes = c.planes.map((p) => PlanDef.desde(p)).filter((p): p is PlanDef => p !== null)
      const universidades = c.universidades
        .map((u) => Universidad.desde(u))
        .filter((u): u is Universidad => u !== null)
      const reg = new Registro(universidades, planes).saneado()
      return reg.hayPlanes ? reg : null
    } catch {
      return null
    }
  }

  /**
   * Guarda este registro como caché. Silencioso si el storage no está.
   * Se escribe la forma CANÓNICA, no las instancias: el caché tiene que hablar
   * exactamente el mismo idioma que el cable y que el bundle, si no `igualA` empezaría a
   * ver diferencias donde no las hay.
   */
  guardarEnCache(): void {
    if (!hayStorage()) return
    try {
      const c = { v: CACHE_VERSION, at: new Date().toISOString(), ...(this.comoJSON() as object) }
      localStorage.setItem(CACHE_KEY, JSON.stringify(c))
    } catch {
      /* sin espacio o en modo privado: seguimos con el bundle, no es fatal */
    }
  }

  static borrarCache(): void {
    if (!hayStorage()) return
    try {
      localStorage.removeItem(CACHE_KEY)
    } catch {
      /* nada que hacer */
    }
  }

  /**
   * Qué planes usa la app en ESTA carga: el caché si sirve, el bundle si no.
   * Se llama una sola vez, al importar `data/planes`.
   */
  static inicial(bundle: Registro): Registro {
    const cache = Registro.leerCache()
    if (!cache) return bundle
    // el caché manda, pero si no trae universidades reusamos las del bundle (los
    // nombres son para mostrar; sin ellas la UI diría el slug)
    return new Registro(
      cache.universidades.length ? cache.universidades : bundle.universidades,
      cache.planes,
    )
  }
}
