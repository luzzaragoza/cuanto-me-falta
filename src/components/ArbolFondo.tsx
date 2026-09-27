import { useEffect, useMemo, useRef, useState } from 'react'

// El árbol de fondo de la bienvenida: un plan de estudios de juguete que se va
// encendiendo solo. No es decoración abstracta — es LA idea de la app contada sin
// palabras: una materia se enciende y con ella lo que necesita antes (naranja) y lo
// que habilita después (oliva). Cuando la persona llega al árbol de verdad, ya vio
// el gesto.
//
// Es una ANIMACIÓN, no un control: las hojas no se tocan. Está detrás de la tarjeta
// donde la persona está eligiendo su carrera y escribiendo su nombre, y competir por
// ese clic sería robarle la atención a lo único que hay que hacer en esta pantalla.
//
// Doce nodos inventados, no un plan real: acá importa la FORMA (que se ramifique y
// vuelva a juntarse), y un plan de verdad a este tamaño sería ilegible.

const W = 150
const H = 52

interface NodoDef {
  id: string
  x: number
  y: number
  p?: string[]
}

const NODOS: NodoDef[] = [
  { id: 'a1', x: 60, y: 120 },
  { id: 'a2', x: 60, y: 300 },
  { id: 'a3', x: 60, y: 480 },
  { id: 'b1', x: 290, y: 200, p: ['a1', 'a2'] },
  { id: 'b2', x: 290, y: 400, p: ['a2'] },
  { id: 'b3', x: 290, y: 580, p: ['a3'] },
  { id: 'c1', x: 520, y: 90, p: ['b1'] },
  { id: 'c2', x: 520, y: 290, p: ['b1', 'b2'] },
  { id: 'c3', x: 520, y: 490, p: ['b2', 'b3'] },
  { id: 'd1', x: 750, y: 190, p: ['c1', 'c2'] },
  { id: 'd2', x: 750, y: 390, p: ['c2', 'c3'] },
  { id: 'e1', x: 980, y: 280, p: ['d1', 'd2'] },
]

/** Por dónde pasa solo. Elegidos para que el recorrido muestre cadenas distintas:
 *  una del medio, una del final, una de arranque… y no siempre la misma rama. */
const CICLO = ['c2', 'd1', 'b2', 'e1', 'c3', 'b1']
/** Cada cuánto salta al siguiente. */
const PASO_MS = 3400
interface Nodo {
  id: string
  x: number
  y: number
  p: string[]
  kids: string[]
}

const GRAFO = (() => {
  const byId: Record<string, Nodo> = {}
  for (const n of NODOS) byId[n.id] = { id: n.id, x: n.x, y: n.y, p: n.p ?? [], kids: [] }
  const aristas: { s: string; t: string }[] = []
  for (const n of NODOS)
    for (const pid of n.p ?? []) {
      byId[pid].kids.push(n.id)
      aristas.push({ s: pid, t: n.id })
    }
  return { lista: NODOS.map((n) => byId[n.id]), byId, aristas }
})()

/** La cadena completa hacia un lado (`p` = lo que necesita · `kids` = lo que habilita). */
function cadena(id: string, lado: 'p' | 'kids'): Set<string> {
  const out = new Set<string>()
  const cola = [...GRAFO.byId[id][lado]]
  while (cola.length) {
    const c = cola.shift()!
    if (out.has(c)) continue
    out.add(c)
    for (const x of GRAFO.byId[c][lado]) cola.push(x)
  }
  return out
}

/** La rama de `s` a `t`. Los puntos de control van CRUZADOS (x2,y1) y (x1,y2): eso
 *  le da la curva en ese que hace que se lea como una rama y no como un cable. */
function rama(s: Nodo, t: Nodo): string {
  const x1 = s.x + W
  const y1 = s.y + H / 2
  const x2 = t.x
  const y2 = t.y + H / 2
  return `M${x1} ${y1} C${x2} ${y1}, ${x1} ${y2}, ${x2} ${y2}`
}

export function ArbolFondo() {
  const [sel, setSel] = useState<string>(CICLO[0])
  const i = useRef(0)

  // `xMinYMid` en el teléfono: ahí el árbol es una banda angosta arriba y hay que
  // anclarla a la IZQUIERDA, donde nace; centrarla mostraría el medio del dibujo.
  const [angosto, setAngosto] = useState(() => window.matchMedia('(max-width: 720px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const onChange = () => setAngosto(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    // Con "reducir movimiento" el árbol se queda quieto en su primer nodo: sigue
    // contando la idea (una cadena encendida), sin nada moviéndose solo.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => {
      i.current = (i.current + 1) % CICLO.length
      setSel(CICLO[i.current])
    }, PASO_MS)
    return () => clearInterval(t)
  }, [])

  const { antes, despues } = useMemo(
    () => ({ antes: cadena(sel, 'p'), despues: cadena(sel, 'kids') }),
    [sel],
  )

  const rolDe = (id: string) => {
    if (id === sel) return 'sel'
    if (antes.has(id)) return 'atras'
    if (despues.has(id)) return 'adelante'
    return 'idle'
  }

  // las ramas encendidas se dibujan ENCIMA de las apagadas
  const ramas = GRAFO.aristas
    .map((e) => {
      const up = (antes.has(e.s) || e.s === sel) && (antes.has(e.t) || e.t === sel)
      const dn = (despues.has(e.s) || e.s === sel) && (despues.has(e.t) || e.t === sel)
      const rol = up ? 'atras' : dn ? 'adelante' : ''
      return { e, rol, d: rama(GRAFO.byId[e.s], GRAFO.byId[e.t]) }
    })
    .sort((a, b) => Number(!!a.rol) - Number(!!b.rol))

  return (
    <div className="w-arbol">
      {/* Decorativo puro: fuera del árbol de accesibilidad y sin foco. */}
      {/* El árbol va SIEMPRE al tamaño del diseño (1200×700), centrado, y lo que no
          entra se recorta. El diseño está hecho en un marco de 920×700: ahí `slice`
          da escala 1, pero en una ventana real (1900×900) la misma regla lo agranda
          1,6× y las materias quedan enormes. Tamaño fijo + centrado da el MISMO
          recorte que el diseño a 920, y en pantallas más grandes simplemente se ve
          más árbol. En el teléfono es otra cosa: una banda de 210px donde sí hay que
          escalar para llenarla, anclada a la izquierda que es donde nace. */}
      <svg
        viewBox="0 0 1200 700"
        width={angosto ? '100%' : 1200}
        height={angosto ? '100%' : 700}
        preserveAspectRatio={angosto ? 'xMinYMid slice' : 'xMidYMid meet'}
        aria-hidden="true"
        focusable="false"
      >
        {/* La clase la pone React porque React ya sabe si hay algo encendido:
            deducirlo desde CSS con :has() sería preguntarle al navegador algo
            que acá arriba es un booleano. */}
        <g className={'wa-ramas' + (sel ? ' activo' : '')}>
          {ramas.map(({ e, rol, d }) => (
            <path key={`${e.s}->${e.t}`} className={'wa-rama' + (rol ? ` ${rol}` : '')} d={d} />
          ))}
        </g>
        <g className="wa-hojas">
          {GRAFO.lista.map((n) => (
            <rect
              key={n.id}
              className={`wa-hoja ${rolDe(n.id)}`}
              x={n.x}
              y={n.y}
              width={W}
              height={H}
              rx={18}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
