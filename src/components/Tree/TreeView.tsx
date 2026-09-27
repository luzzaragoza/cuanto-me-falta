import { useEffect, useMemo, useRef, useState } from 'react'
import { Plan, plan as planAlumno } from '../../domain/Plan'
import { useDB } from '../../state/store'
import type { Estado } from '../../types'
import { useExitAnimation } from '../../hooks/useExitAnimation'
import { Analytics } from '../../lib/analytics'
import {
  planoDe,
  curvaArista,
  GX,
  NW,
  PAD,
  type NodoPlano,
  type PlanoArbol,
} from '../../lib/arbolPlano'

// El árbol como LÍNEA DE TIEMPO (rediseño 2-sep): columnas por cuatrimestre, bandas
// por año, y las correlativas siempre visibles como curvas tenues. Pasar el mouse
// por una materia (o tocarla) resalta su cadena completa EN EL LUGAR: naranja lo
// que necesita, oliva lo que habilita, el resto se apaga. Un clic la fija.
//
// Acá no hay motor de layout ni lienzo de terceros: el plano es una cuenta
// (`arbolPlano.ts`) y el zoom es un transform con scroll. Con este modelo murió el
// "modo rama" (la cadena ya no viaja: se ilumina donde está) y con él se fueron
// elkjs y React Flow — el chunk del árbol pasó de ~506 KB gz a unos pocos KB.

/** Zoom permitido. El piso bajo existe para la vista de mapa en el teléfono. */
// Cuándo el árbol se arma con el cromo del teléfono. No alcanza con el ANCHO: un
// celular acostado mide 667–844 de ancho y le tocaba el de PC, que apila cabecera,
// chips, barra y pie — 260 de 340px, y al árbol le quedaban 66. Lo que delata a un
// teléfono acostado es el ALTO (ninguno pasa de ~430; ninguna compu ni tablet baja de
// ~600). ⚠️ La misma consulta está en global.css: tienen que coincidir.
const MQ_TELEFONO = '(max-width: 640px), (max-height: 500px)'

const ZOOM_MIN = 0.11
const ZOOM_MAX = 1.6
/** Debajo de esto las tarjetas pierden el texto y quedan como teselas de color:
 *  a ese tamaño el nombre sería ruido de 4px. (En el diseño era solo del celular;
 *  acá corre en todos lados porque el problema es el zoom, no el dispositivo.) */
const ZOOM_MAPA = 0.42
/** Cuánto sobrevive el resaltado después de que el mouse sale de una tarjeta.
 *  Medido contra el plano: entre columnas hay 104 px de aire (GX), y a una mano
 *  lenta —unos 400 px/s— cruzarlos lleva ~260 ms. Con menos que eso, ir de una
 *  materia a la de al lado apaga y prende la cadena en el camino: medio lienzo
 *  cambiando de opacidad y la barra de arriba cambiando con él, una vez por hueco.
 *  Lo que se paga a cambio es que la cadena tarda 0,3 s en soltarse cuando uno se
 *  va del árbol de verdad, que no se nota. */
const SOLTAR_HOVER_MS = 300

/**
 * Con cuánto zoom abre en el teléfono. Era un 0,62 clavado y se veía chico y lejos
 * (reporte de Luz, 8-sep): tarjetas de 129 px y aire sobrando. Ahora el ancho se
 * LLENA con una regla: entra el margen del plano, el cuatrimestre completo, el aire
 * y **la mitad del cuatrimestre siguiente** — entero se lee, y el que asoma es lo
 * que dice que la carrera sigue a la derecha. El número sale del aparato: 79 % en un
 * iPhone, 64 % en uno de 320 px, y topea en 1 (agrandar más que el diseño no suma).
 * Mirado al lado de las alternativas: a 89 % entra una columna sola y se pierde el
 * hilo, a 62 % se lee todo pero chiquito. Ojo con la cuenta: el margen del plano
 * (PAD) ocupa pantalla al abrir, porque el lienzo arranca con el scroll en cero.
 */
const zoomDeApertura = (anchoVentana: number) =>
  Math.max(ZOOM_MIN, Math.min(1, (anchoVentana - 28) / (PAD + 1.5 * NW + GX)))

const ORDINAL = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto']
const cuando = (n: NodoPlano) =>
  `${ORDINAL[n.year - 1] ?? `${n.year}°`} año · ${n.cuatri}° cuatrimestre`

/** Cómo se nombra cada estado en la ficha de la materia. */
const EST_TXT: Record<Estado, string> = {
  aprobada: 'aprobada',
  final: 'pendiente de final',
  cursando: 'cursando',
  pendiente: 'pendiente',
}

/** El resumen de avance del pie: los tres estados que se cuentan (pendiente no
 *  se lista — es el resto, y decirlo sería contar dos veces lo mismo). */
const RESUMEN: { est: Estado; label: string }[] = [
  { est: 'aprobada', label: 'aprobadas' },
  { est: 'final', label: 'pend. de final' },
  { est: 'cursando', label: 'cursando' },
]

/**
 * Modo edición: el árbol pasa a ser la superficie para CARGAR correlativas (lo usa el
 * editor de planes). El objetivo es la materia elegida; `elegibles` son las que se
 * pueden conectar en la dirección activa y se muestran clickeables; el resto queda
 * apagado pero sigue vivo: tocarlo cambia el objetivo.
 *
 * ⚠️ El editor de la administración tiene su propio rediseño pendiente: este modo se
 * mantiene FUNCIONAL sobre el lienzo nuevo, sin pulido visual propio.
 */
export interface ModoEdicion {
  objetivo: string
  direccion: 'anterior' | 'posterior'
  elegibles: Set<string>
  yaConectadas: Set<string>
  onAlternar: (cod: string) => void
  onElegirObjetivo: (cod: string) => void
  /** Por qué esa materia no se puede conectar (para el tooltip). */
  porQueNo?: (cod: string) => string | null
}

const FitIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
)

const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
)

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
)

/** Las cinco referencias del lienzo. En PC viven fijas abajo a la izquierda; en el
 *  teléfono son un panel que abre el botón ⓘ de la cabecera. */
function Leyenda() {
  return (
    <>
      <div className="tv-ley-item">
        <span className="tv-ley-linea need" />
        <span className="tv-ley-tx need">necesita antes</span>
      </div>
      <div className="tv-ley-item">
        <span className="tv-ley-linea unlock" />
        <span className="tv-ley-tx unlock">habilita después</span>
      </div>
      <div className="tv-ley-item">
        <span className="tv-ley-linea idle" />
        <span className="tv-ley-tx">correlatividad</span>
      </div>
      <div className="tv-ley-item">
        <span className="tv-ley-caja opt" />
        <span className="tv-ley-tx">optativa</span>
      </div>
      <div className="tv-ley-item">
        <span className="tv-ley-caja esp" />
        <span className="tv-ley-tx">habilitación especial</span>
      </div>
    </>
  )
}

export function TreeView({
  onClose,
  focus,
  planExterno,
  edicion,
}: {
  onClose: () => void
  focus: string | null
  /** Plan a dibujar. Sin esto usa el del alumno (el singleton del dominio). */
  planExterno?: Plan
  edicion?: ModoEdicion
}) {
  const plan = planExterno ?? planAlumno
  const enEdicion = edicion !== undefined
  const db = useDB()
  // El avance solo se pinta sobre el plan DEL ALUMNO. En el editor se dibuja un plan
  // ajeno (el borrador), y ahí los códigos podrían coincidir por casualidad con los
  // de la carrera del alumno: pintaríamos un progreso que no es de ese plan.
  const verProgreso = planExterno === undefined
  const estadoDe = (cod: string): Estado => (verProgreso ? db.estado(cod) : 'pendiente')
  const { closing, requestClose, onExitEnd } = useExitAnimation(onClose)

  // ¿La pantalla es de teléfono? Cambia el cromo (chips + ficha + leyenda plegada),
  // no el lienzo. Vivo: rotar el teléfono o achicar la ventana lo actualiza.
  const [esMobile, setEsMobile] = useState(() => window.matchMedia(MQ_TELEFONO).matches)
  useEffect(() => {
    const mq = window.matchMedia(MQ_TELEFONO)
    const onChange = () => setEsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  // hover solo donde el hover existe: en touch, mouseenter dispara con el tap y
  // dejaría cadenas "pegadas" sin manera de soltarlas
  const conHover = useMemo(() => window.matchMedia('(hover: hover)').matches, [])

  const plano: PlanoArbol = useMemo(() => planoDe(plan), [plan])

  const [sel, setSel] = useState<string | null>(focus)
  const [hover, setHover] = useState<string | null>(null)
  // el 28 son los 14 px de aire a cada lado del lienzo en el teléfono
  const [zoom, setZoom] = useState(() => (esMobile ? zoomDeApertura(window.innerWidth) : 1))
  const [anio, setAnio] = useState(1)
  const [leyenda, setLeyenda] = useState(false)

  // En el editor, el foco lo maneja la pantalla de afuera (cambia al elegir otra
  // materia). En la app del alumno `focus` solo importa al abrir, y esto no corre.
  useEffect(() => {
    if (enEdicion) setSel(focus)
  }, [focus, enEdicion])

  // El hover ENTRA al instante (tiene que sentirse inmediato) y SALE con demora,
  // cancelable: si el mouse entra a otra tarjeta antes de que venza, la cadena pasa
  // de una a la otra sin pasar por el estado vacío.
  const hoverTimer = useRef<number | undefined>(undefined)
  const entrarHover = (cod: string) => {
    clearTimeout(hoverTimer.current)
    setHover(cod)
  }
  const salirHover = () => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setHover(null), SOLTAR_HOVER_MS)
  }
  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  const lienzo = useRef<HTMLDivElement | null>(null)
  // El pie del teléfono FLOTA sobre el lienzo, así que su franja es alto visible
  // que no se puede usar. Se mide el elemento en vez de repetir un número acá: la
  // ficha y la pista miden distinto, y el diseño puede cambiar sin avisarle a esto.
  const pie = useRef<HTMLDivElement | null>(null)
  const altoPie = () => pie.current?.offsetHeight ?? 0

  // los listeners de abajo se cuelgan una vez; leen el estado por ref
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  /** Cambia el zoom manteniendo un punto del viewport quieto (el centro, el cursor
   *  o el medio del pellizco). Sin el ancla, acercar "se va" del lugar mirado. */
  const zoomHacia = (nz: number, ancla?: { cx: number; cy: number }) => {
    const el = lienzo.current
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nz))
    if (!el) {
      setZoom(z)
      return
    }
    const cx = ancla?.cx ?? el.clientWidth / 2
    const cy = ancla?.cy ?? el.clientHeight / 2
    const ox = (el.scrollLeft + cx) / zoom
    const oy = (el.scrollTop + cy) / zoom
    setZoom(z)
    requestAnimationFrame(() => {
      el.scrollLeft = ox * z - cx
      el.scrollTop = oy * z - cy
    })
  }

  const zoomHaciaRef = useRef(zoomHacia)
  zoomHaciaRef.current = zoomHacia

  const verTodo = () => {
    const el = lienzo.current
    if (!el) return
    setZoom(
      Math.max(
        ZOOM_MIN,
        Math.min(
          (el.clientWidth - 24) / plano.w,
          (el.clientHeight - altoPie() - 24) / plano.h,
        ),
      ),
    )
  }

  // pellizco (touch) + rueda con Ctrl (trackpad/mouse), los dos anclados
  useEffect(() => {
    const el = lienzo.current
    if (!el) return
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    let pinch: { d: number; z: number; cx: number; cy: number } | null = null
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        pinch = null
        return
      }
      const r = el.getBoundingClientRect()
      pinch = {
        d: dist(e.touches),
        z: zoomRef.current,
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top,
      }
    }
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      zoomHaciaRef.current(pinch.z * (dist(e.touches) / pinch.d), { cx: pinch.cx, cy: pinch.cy })
    }
    const onEnd = () => {
      pinch = null
    }
    // La rueda ACERCA y ALEJA, siempre — no hace falta Ctrl. Es un lienzo, no un
    // documento: para moverse se arrastra el fondo. (Ctrl+rueda cae acá también,
    // que es el gesto de pellizco del trackpad, y el preventDefault evita que el
    // navegador haga su propio zoom de página encima.)
    //
    // El paso es PROPORCIONAL a lo que informa el evento, no un salto fijo: un
    // mouse manda un golpe grande por muesca (~100) y un trackpad una lluvia de
    // eventos chiquitos (~5). Con un factor fijo por evento, el trackpad se iría
    // al fondo de una pasada.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // deltaMode 1 = líneas (algunos mouse de Firefox): pasarlo a píxeles
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      // techo por evento, para que un golpe enorme no pegue un salto
      const paso = Math.min(Math.max(Math.exp(-dy * 0.0011), 0.82), 1.22)
      const r = el.getBoundingClientRect()
      zoomHaciaRef.current(zoomRef.current * paso, {
        cx: e.clientX - r.left,
        cy: e.clientY - r.top,
      })
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  // arrastrar el fondo para moverse (el clic en una tarjeta no arrastra), y el clic
  // sin arrastre suelta la cadena fijada: tocar el fondo es decir "no estoy mirando
  // ninguna". Distinguir las dos cosas pide medir el desplazamiento — moverse por el
  // lienzo no es una decisión sobre la selección, y soltarla al terminar de panear
  // sería perderla sin haberla tocado.
  const onPanStart = (e: React.MouseEvent) => {
    const el = lienzo.current
    if (!el || (e.target as HTMLElement).closest('[data-nodo]')) return
    const sx = e.clientX
    const sy = e.clientY
    const sl = el.scrollLeft
    const st = el.scrollTop
    let arrastro = false
    el.classList.add('agarrado')
    const move = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) arrastro = true
      el.scrollLeft = sl - (ev.clientX - sx)
      el.scrollTop = st - (ev.clientY - sy)
    }
    const up = () => {
      el.classList.remove('agarrado')
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      // en el editor el objetivo lo maneja la pantalla de afuera: acá no se toca
      if (!arrastro && !enEdicion) {
        setSel(null)
        // también el hover, y sin esperar la demora: si el clic dice "ninguna", el
        // lienzo tiene que quedar limpio en el acto, no dentro de un tercio de segundo
        clearTimeout(hoverTimer.current)
        setHover(null)
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // chips de año (teléfono): saber cuál está a la vista y saltar a uno
  const syncAnio = () => {
    const el = lienzo.current
    if (!el) return
    const mid = (el.scrollLeft + el.clientWidth * 0.35) / zoomRef.current
    let visto = plano.bandas[0]?.year ?? 1
    for (const b of plano.bandas) if (b.colX - 26 <= mid) visto = b.year
    setAnio((prev) => (prev === visto ? prev : visto))
  }
  const saltarAnio = (year: number) => {
    const el = lienzo.current
    const banda = plano.bandas.find((b) => b.year === year)
    if (!el || !banda) return
    el.scrollTo({ left: Math.max(0, (banda.colX - 40) * zoom), behavior: 'smooth' })
    setAnio(year)
  }

  // abrir con foco: la materia llega ya fijada; acá solo la traemos a la vista
  useEffect(() => {
    const el = lienzo.current
    const nodo = focus ? plano.porCod.get(focus) : null
    if (!el || !nodo) return
    el.scrollLeft = (nodo.x + NW / 2) * zoomRef.current - el.clientWidth / 2
    el.scrollTop = (nodo.y + 43) * zoomRef.current - (el.clientHeight - altoPie()) / 2
    syncAnio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc suelta la cadena fijada antes de cerrar (mismo contrato que el modo rama)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (!enEdicion && sel) setSel(null)
      else requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose, sel, enEdicion])

  // ── la cadena activa ──────────────────────────────────────────────────────
  const activo = enEdicion ? null : (sel ?? hover)
  const arriba = useMemo(
    () => (activo ? plan.chainUp(activo) : new Set<string>()),
    [plan, activo],
  )
  const abajo = useMemo(
    () => (activo ? plan.chainDown(activo) : new Set<string>()),
    [plan, activo],
  )

  const clickNodo = (n: NodoPlano) => {
    if (edicion) {
      if (n.cod === edicion.objetivo) return
      if (edicion.elegibles.has(n.cod) || edicion.yaConectadas.has(n.cod)) edicion.onAlternar(n.cod)
      else edicion.onElegirObjetivo(n.cod)
      return
    }
    const next = sel === n.cod ? null : n.cod
    setSel(next)
    // mide si descubren el gesto de fijar una cadena (heredero de `arbol_rama`:
    // el nombre se conserva para no cortar la serie del dashboard de métricas)
    if (next && plan.chainUp(next).size + plan.chainDown(next).size > 0)
      Analytics.evento('arbol_rama')
  }

  /** El rol visual de cada tarjeta (alumno o edición, según el modo). */
  const rolDe = (n: NodoPlano): string => {
    if (edicion) {
      if (n.cod === edicion.objetivo) return 'sel'
      if (edicion.yaConectadas.has(n.cod))
        return edicion.direccion === 'anterior' ? 'up' : 'down'
      if (edicion.elegibles.has(n.cod)) return 'elegible'
      return 'dim'
    }
    if (!activo) return ''
    if (n.cod === activo) return 'sel'
    if (arriba.has(n.cod)) return 'up'
    if (abajo.has(n.cod)) return 'down'
    return 'dim'
  }

  // aristas: primero las apagadas, encima las de la cadena
  const aristas = useMemo(() => {
    const conActivo = (cods: Set<string>, cod: string) => cods.has(cod) || cod === activo
    return plano.aristas
      .map((a) => {
        let rol = ''
        if (edicion) {
          const toca =
            (a.de === edicion.objetivo && edicion.yaConectadas.has(a.a)) ||
            (a.a === edicion.objetivo && edicion.yaConectadas.has(a.de))
          if (toca) rol = edicion.direccion === 'anterior' ? 'up' : 'down'
        } else if (activo) {
          if (conActivo(arriba, a.de) && conActivo(arriba, a.a)) rol = 'up'
          else if (conActivo(abajo, a.de) && conActivo(abajo, a.a)) rol = 'down'
          else rol = 'off'
        }
        return { ...a, rol, d: curvaArista(plano.porCod.get(a.de)!, plano.porCod.get(a.a)!) }
      })
      .sort((x, y) => Number(x.rol === 'up' || x.rol === 'down') - Number(y.rol === 'up' || y.rol === 'down'))
  }, [plano, activo, arriba, abajo, edicion])

  const mapa = zoom < ZOOM_MAPA
  const nodoActivo = activo ? plano.porCod.get(activo) : null
  // Los conteos cuentan las correlativas DIRECTAS, igual que el panel de la fila en
  // la pantalla principal: es la misma pregunta ("¿qué me piden para anotarme?") y
  // tiene que dar el mismo número. Lo que se ilumina en el lienzo sigue siendo la
  // cadena COMPLETA — son dos lecturas distintas: la pastilla dice el requisito,
  // el color muestra de dónde viene.
  const nNecesita = activo ? plan.antes(activo).length : 0
  const nHabilita = activo ? plan.despues(activo).length : 0
  const etiquetaUp =
    nNecesita === 0 ? 'No necesita ninguna' : nNecesita === 1 ? 'Necesita 1 materia' : `Necesita ${nNecesita} materias`
  const etiquetaDown =
    nHabilita === 0 ? 'No habilita ninguna' : nHabilita === 1 ? 'Habilita 1 materia' : `Habilita ${nHabilita} materias`

  const resumen = useMemo(() => {
    if (!verProgreso) return []
    const cuenta = new Map<Estado, number>()
    for (const n of plano.nodos) {
      const e = estadoDe(n.cod)
      cuenta.set(e, (cuenta.get(e) ?? 0) + 1)
    }
    return RESUMEN.map((r) => ({ ...r, n: cuenta.get(r.est) ?? 0 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plano, db, verProgreso])

  const subtitulo = `${plan.carrera} · ${plano.nodos.length} materias · ${plano.bandas.length} años`

  return (
    <div className={`treeview${closing ? ' closing' : ''}`} onAnimationEnd={onExitEnd}>
      <header className="tv-head">
        <button className="tv-volver" type="button" onClick={requestClose} aria-label="Volver al inicio">
          <BackIcon />
          {!esMobile && <span>Inicio</span>}
        </button>
        <div className="tv-tit">
          <h2>Árbol de correlativas</h2>
          <p>{subtitulo}</p>
        </div>
        {esMobile && (
          <button
            className={'tv-ley-btn' + (leyenda ? ' on' : '')}
            type="button"
            aria-expanded={leyenda}
            aria-label="Referencias"
            onClick={() => setLeyenda((v) => !v)}
          >
            <InfoIcon />
          </button>
        )}
      </header>

      {/* Los chips saltan de año y dicen en cuál estás. Nacieron para el teléfono y
          Luz los pidió también en PC: el lienzo es igual de largo en las dos, y ahí
          la única forma de llegar a 5° año era arrastrar. */}
      {!enEdicion && (
        <div className="tv-chips">
          {plano.bandas.map((b) => (
            <button
              key={b.year}
              type="button"
              className={'tv-chip' + (anio === b.year ? ' on' : '')}
              onClick={() => saltarAnio(b.year)}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {!esMobile && !enEdicion && (
        <div className="tv-status">
          {nodoActivo ? (
            <div className="tv-status-grid">
              <div className="tv-status-quien">
                <div className="tv-status-nom">{nodoActivo.nom}</div>
                <div className="tv-status-cuando">
                  {cuando(nodoActivo)}
                  {verProgreso && ` · ${EST_TXT[estadoDe(nodoActivo.cod)]}`}
                </div>
              </div>
              <div className="tv-pill up">{etiquetaUp}</div>
              <div className="tv-pill down">{etiquetaDown}</div>
            </div>
          ) : (
            <span className="tv-status-hint">
              Pasá el mouse sobre una materia para ver su cadena completa. Click para fijarla;
              arrastrá el fondo para moverte y usá la rueda para acercar.
            </span>
          )}
          {sel && (
            <button className="tv-soltar" type="button" onClick={() => setSel(null)}>
              Soltar
            </button>
          )}
        </div>
      )}

      <div className="tv-marco">
        <div
          className="tv-lienzo"
          ref={lienzo}
          onMouseDown={onPanStart}
          onScroll={enEdicion ? undefined : syncAnio}
        >
          <div
            className="tv-escala"
            style={{ width: Math.round(plano.w * zoom), height: Math.round(plano.h * zoom) }}
          >
            <div
              className={'tv-plano' + (mapa ? ' mapa' : '')}
              style={{ width: plano.w, height: plano.h, transform: `scale(${zoom})` }}
            >
              {plano.bandas.map((b) => (
                <div
                  key={b.year}
                  className={'tv-banda' + (b.alt ? ' alt' : '')}
                  style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
                />
              ))}
              {plano.bandas.map((b) => (
                <div key={b.year} className="tv-banda-lbl" style={{ left: b.lx, top: b.ly }}>
                  {b.label}
                </div>
              ))}
              {plano.cuatris.map((c, i) => (
                <div key={i} className="tv-cuatri-kick" style={{ left: c.x, top: c.y, width: c.w }}>
                  {c.label}
                </div>
              ))}

              <svg className="tv-aristas" width={plano.w} height={plano.h} aria-hidden="true">
                {aristas.map((a) => (
                  <path key={`${a.de}->${a.a}`} className={'ta' + (a.rol ? ` ${a.rol}` : '')} d={a.d} />
                ))}
              </svg>

              {plano.nodos.map((n) => {
                const rol = rolDe(n)
                const noConectable = edicion && rol === 'dim'
                return (
                  <div
                    key={n.cod}
                    data-nodo
                    role="button"
                    tabIndex={mapa ? -1 : 0}
                    className={
                      'tv-nodo' +
                      (rol ? ` ${rol}` : '') +
                      (n.opt ? ' opt' : '') +
                      (n.esp ? ' esp' : '')
                    }
                    style={{ left: n.x, top: n.y }}
                    title={noConectable ? (edicion?.porQueNo?.(n.cod) ?? undefined) : undefined}
                    onMouseEnter={conHover && !enEdicion ? () => entrarHover(n.cod) : undefined}
                    onMouseLeave={conHover && !enEdicion ? salirHover : undefined}
                    onClick={() => clickNodo(n)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        clickNodo(n)
                      }
                    }}
                  >
                    {verProgreso && estadoDe(n.cod) !== 'pendiente' && (
                      <span className={`tv-riel ${estadoDe(n.cod)}`} aria-hidden="true" />
                    )}
                    <div className="tv-nodo-nom">{n.nom}</div>
                    {(n.opt || n.esp) && (
                      <div className="tv-nodo-badge">
                        {n.opt ? 'optativa' : 'habilitación especial'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {esMobile && leyenda && (
          <div className="tv-ley-panel">
            {resumen.length > 0 && (
              <div className="tv-resumen">
                {resumen.map((r) => (
                  <div className="tv-res-item" key={r.est}>
                    <span className={`tv-riel ${r.est}`} />
                    <span className="tv-ley-tx">
                      <b>{r.n}</b> {r.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Leyenda />
          </div>
        )}

        {esMobile && (
          <div className="tv-zoom vertical">
            <button className="tv-zbtn" type="button" onClick={() => zoomHacia(zoom * 1.2)} aria-label="Acercar">+</button>
            <div className="tv-zpct">{Math.round(zoom * 100)}%</div>
            <button className="tv-zbtn" type="button" onClick={() => zoomHacia(zoom / 1.2)} aria-label="Alejar">–</button>
            <button className="tv-zbtn" type="button" onClick={verTodo} aria-label="Ver todo el plan">
              <FitIcon />
            </button>
          </div>
        )}
      </div>

      {/* En PC la leyenda y el zoom NO flotan sobre el lienzo: viven en una fila
          propia al pie, con el resumen de avance a la izquierda. Flotando tapaban
          materias justo en las esquinas por las que uno arrastra. */}
      {!esMobile && (
        <div className="tv-pie-pc">
          {resumen.length > 0 && (
            <div className="tv-resumen">
              {resumen.map((r) => (
                <div className="tv-res-item" key={r.est}>
                  <span className={`tv-riel ${r.est}`} />
                  <span className="tv-ley-tx">
                    <b>{r.n}</b> {r.label}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="tv-leyenda">
            <Leyenda />
          </div>
          <div className="tv-zoom">
            <button className="tv-zbtn" type="button" onClick={() => zoomHacia(zoom / 1.18)} aria-label="Alejar">–</button>
            <div className="tv-zpct">{Math.round(zoom * 100)}%</div>
            <button className="tv-zbtn" type="button" onClick={() => zoomHacia(zoom * 1.18)} aria-label="Acercar">+</button>
            <div className="tv-zsep" />
            <button className="tv-ztodo" type="button" onClick={verTodo}>
              Ver todo
            </button>
          </div>
        </div>
      )}

      {esMobile && !enEdicion && (
        <div className="tv-pie" ref={pie}>
          {nodoActivo ? (
            <div className="tv-ficha">
              <div className="tv-ficha-top">
                <div className="tv-ficha-tx">
                  <div className="tv-ficha-nom">{nodoActivo.nom}</div>
                  <div className="tv-ficha-cuando">
                    {cuando(nodoActivo)}
                    {verProgreso && ` · ${EST_TXT[estadoDe(nodoActivo.cod)]}`}
                  </div>
                </div>
                <button className="tv-ficha-x" type="button" onClick={() => setSel(null)} aria-label="Soltar">
                  ×
                </button>
              </div>
              <div className="tv-ficha-pills">
                <div className="tv-pill up">{etiquetaUp.replace(' materias', '').replace(' materia', '')}</div>
                <div className="tv-pill down">{etiquetaDown.replace(' materias', '').replace(' materia', '')}</div>
              </div>
            </div>
          ) : (
            <div className="tv-hint-m">
              Tocá una materia para ver su cadena. Arrastrá para moverte, pellizcá para acercar.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
