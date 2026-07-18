import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Controls,
  MarkerType,
  Panel,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { plan } from '../../domain/Plan'
import { nombreDe } from '../../domain/selectors'
import { useDB } from '../../state/store'
import { useExitAnimation } from '../../hooks/useExitAnimation'
import {
  layoutGrafo,
  layoutMalla,
  subgrafoRama,
  NODEW,
  type ArbolLayout,
  type GrafoPlan,
  type Punto,
} from '../../lib/arbolLayout'
import { MateriaNode, type NodeRole } from './MateriaNode'
import { BandNode } from './BandNode'
import { TreeEdge, type TreeEdgeData } from './TreeEdge'
import { YearRail } from './YearRail'
import { bandasDe } from './bandas'

/** Rótulo de fila del modo rama: cada escalón dice su año·cuatrimestre. */
function RotuloNode({ data }: NodeProps) {
  return <div className="rot-rama">{(data as { txt: string }).txt}</div>
}

const nodeTypes = { materia: MateriaNode, band: BandNode, rotulo: RotuloNode }
const edgeTypes = { tree: TreeEdge }

// Escalas de color por profundidad: directas claritas → más lejos, más oscuro.
const NEED_SHADES = [
  { background: '#ECE6FB', borderColor: '#C4B2EF', color: '#4A35A0' },
  { background: '#C7B2F0', borderColor: '#A083E2', color: '#3A2880' },
  { background: '#9C79E5', borderColor: '#7E55D8', color: '#ffffff' },
  { background: '#6B4FCF', borderColor: '#543AAE', color: '#ffffff' },
]
const UNLOCK_SHADES = [
  { background: '#D6F0ED', borderColor: '#A2D7D0', color: '#0A5F5C' },
  { background: '#A6DDD5', borderColor: '#75C5BB', color: '#07514E' },
  { background: '#4FB6AC', borderColor: '#2E9E93', color: '#ffffff' },
  { background: '#0E8C8C', borderColor: '#0A6E6E', color: '#ffffff' },
]
const shadeIdx = (lvl: number | undefined) => Math.min(Math.max((lvl ?? 1) - 1, 0), 3)

/** La rama de `sel` re-acomodada compacta ("modo rama"), corrida para nacer
 *  cerca de sus posiciones en la malla → el viaje de las tarjetas es corto.
 *  Las flechas viven SOLO acá: en reposo la malla es la grilla limpia
 *  (decisión de producto 18-jul). */
interface Rama {
  foco: string
  pos: Record<string, Punto>
  aristas: Record<string, Punto[]>
  cods: Set<string>
  filas: { cuatri: number; top: number; bottom: number }[]
  minX: number
}

function centrarRama(lay: ArbolLayout, malla: ArbolLayout): { dx: number; dy: number } {
  const cods = Object.keys(lay.pos)
  const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1)
  const dx = prom(cods.map((c) => malla.pos[c]?.x ?? 0)) - prom(cods.map((c) => lay.pos[c].x))
  // vertical: que la rama arranque donde arranca su primera materia en la malla
  // (cae en la misma zona temporal; el escalonado por cuatri ya viene del layout)
  const dy =
    Math.min(...cods.map((c) => malla.pos[c]?.y ?? 0)) - Math.min(...cods.map((c) => lay.pos[c].y))
  return { dx, dy }
}

export function TreeView({ onClose, focus }: { onClose: () => void; focus: string | null }) {
  const db = useDB()
  const [sel, setSel] = useState<string | null>(focus)
  const { closing, requestClose, onExitEnd } = useExitAnimation(onClose)
  const flowRef = useRef<ReactFlowInstance | null>(null)
  const [flowListo, setFlowListo] = useState(false)

  const grafo: GrafoPlan = useMemo(
    () => ({ materias: plan.def.materias, correlativas: plan.def.correlativas }),
    [],
  )

  // ── layout de la MALLA (una vez; ELK es async pero tarda ms) ──
  // grilla compacta nuestra + ruteo ELK: el mapa se recorre, no se explora
  const [malla, setMalla] = useState<ArbolLayout | null>(null)
  useEffect(() => {
    let vivo = true
    void layoutMalla(grafo).then((l) => {
      if (vivo) setMalla(l)
    })
    return () => {
      vivo = false
    }
  }, [grafo])
  const bandas = useMemo(() => (malla ? bandasDe(malla) : []), [malla])

  // ── layout de la RAMA al seleccionar (modo rama: la cadena se junta) ──
  const [rama, setRama] = useState<Rama | null>(null)
  useEffect(() => {
    if (!sel || !malla) {
      setRama(null)
      return
    }
    const sub = subgrafoRama(grafo, sel)
    if (sub.materias.length <= 1) {
      setRama(null) // sin cadena no hay rama que juntar: queda la malla
      return
    }
    let vivo = true
    void layoutGrafo(sub).then((lay) => {
      if (!vivo) return
      const { dx, dy } = centrarRama(lay, malla)
      const pos: Rama['pos'] = {}
      for (const [cod, p] of Object.entries(lay.pos)) pos[cod] = { x: p.x + dx, y: p.y + dy }
      const aristas: Rama['aristas'] = {}
      for (const [id, pts] of Object.entries(lay.aristas))
        aristas[id] = pts.map((p) => ({ x: p.x + dx, y: p.y + dy }))
      setRama({
        foco: sel,
        pos,
        aristas,
        cods: new Set(Object.keys(lay.pos)),
        filas: lay.filas.map((f) => ({ ...f, top: f.top + dy, bottom: f.bottom + dy })),
        minX: Math.min(...Object.values(pos).map((p) => p.x)),
      })
    })
    return () => {
      vivo = false
    }
  }, [sel, malla, grafo])

  const enRama = rama !== null && rama.foco === sel

  // ── cámara: entrar a la rama la encuadra; salir vuelve a donde estabas ──
  const viewportPrevio = useRef<Viewport | null>(null)
  useEffect(() => {
    const inst = flowRef.current
    if (!inst || !flowListo) return
    if (enRama && rama) {
      if (!viewportPrevio.current) viewportPrevio.current = inst.getViewport()
      // pequeño delay: el encuadre acompaña el viaje de las tarjetas
      const t = setTimeout(() => {
        void inst.fitView({
          nodes: [...rama.cods].map((id) => ({ id })),
          padding: 0.16,
          duration: 600,
          maxZoom: 1.05,
        })
      }, 80)
      return () => clearTimeout(t)
    }
    if (!enRama && viewportPrevio.current) {
      void inst.setViewport(viewportPrevio.current, { duration: 500 })
      viewportPrevio.current = null
    }
  }, [enRama, rama, flowListo])

  // Límite de paneo: no dejar arrastrar el árbol hasta perderlo de vista.
  const translateExtent = useMemo(() => {
    if (!malla) return undefined
    const M = 300
    return [
      [-M, -M],
      [malla.width + M, malla.height + M],
    ] as [[number, number], [number, number]]
  }, [malla])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sel) setSel(null) // primer Esc: salir de la rama; segundo: cerrar
        else requestClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose, sel])

  const up = sel ? plan.chainUp(sel) : new Set<string>()
  const down = sel ? plan.chainDown(sel) : new Set<string>()

  const { nodes, edges } = useMemo(() => {
    if (!malla) return { nodes: [] as Node[], edges: [] as Edge[] }
    const upLvl = sel ? plan.chainUpLevels(sel) : new Map<string, number>()
    const downLvl = sel ? plan.chainDownLevels(sel) : new Map<string, number>()
    const upSet = new Set(upLvl.keys())
    const downSet = new Set(downLvl.keys())

    const role = (cod: string): NodeRole => {
      if (!sel) return 'normal'
      if (cod === sel) return 'sel'
      if (upSet.has(cod)) return 'need'
      if (downSet.has(cod)) return 'unlock'
      return 'dim'
    }
    const tint = (cod: string) => {
      if (!sel) return undefined
      if (upSet.has(cod)) return NEED_SHADES[shadeIdx(upLvl.get(cod))]
      if (downSet.has(cod)) return UNLOCK_SHADES[shadeIdx(downLvl.get(cod))]
      return undefined
    }

    const bandNodes: Node[] = bandas.map((b, i) => ({
      id: `band-${i}`,
      type: 'band',
      position: { x: b.x, y: b.y },
      data: { year: b.year, width: b.width, height: b.height, alt: b.alt, cuatris: b.cuatris },
      className: enRama ? 'fondo-banda' : undefined,
      selectable: false,
      draggable: false,
      connectable: false,
      zIndex: 0,
      // inline porque React Flow pone pointer-events en el wrapper y le gana al
      // CSS: un clic sobre la banda tiene que ser un clic al fondo (= volver)
      style: { pointerEvents: 'none' },
    }))

    const matNodes: Node[] = grafo.materias.map((m) => {
      const viaja = enRama && rama.cods.has(m.cod)
      return {
        id: m.cod,
        type: 'materia',
        position: viaja ? rama.pos[m.cod] : malla.pos[m.cod],
        data: {
          cod: m.cod,
          nom: nombreDe(db, m.cod),
          estado: db.states[m.cod] ?? 'pendiente',
          role: role(m.cod),
          tint: tint(m.cod),
        },
        className: enRama && !viaja ? 'fondo' : undefined,
        draggable: false,
        zIndex: viaja ? 2 : 1,
      }
    })

    // en modo rama, cada escalón lleva su rótulo de año·cuatrimestre al costado
    // (las bandas del fondo quedan borrosas y no acompañan el re-acomodo)
    const rotuloNodes: Node[] = enRama
      ? rama.filas.map((f) => ({
          id: `rot-${f.cuatri}`,
          type: 'rotulo',
          position: { x: rama.minX - 104, y: (f.top + f.bottom) / 2 - 12 },
          data: { txt: `${Math.floor(f.cuatri / 2) + 1}° año · ${(f.cuatri % 2) + 1}C` },
          selectable: false,
          draggable: false,
          connectable: false,
          zIndex: 2,
          style: { pointerEvents: 'none' },
        }))
      : []

    // Flechas SOLO en modo rama (decisión de producto: en reposo la malla es la
    // grilla limpia; las correlatividades aparecen al seleccionar). Toda flecha
    // es sólida: cada una ES una correlativa directa entre sus dos extremos.
    const flecha = (color: string, px: number) => ({
      type: MarkerType.ArrowClosed,
      color,
      width: px,
      height: px,
    })
    const edgeList: Edge[] = []
    if (enRama) {
      for (const [id, pts] of Object.entries(rama.aristas)) {
        const [source, target] = id.split('->')
        const esNeed = upSet.has(target) || target === sel
        const depth = esNeed
          ? Math.max(upLvl.get(source) ?? 1, upLvl.get(target) ?? 0)
          : Math.max(downLvl.get(source) ?? 0, downLvl.get(target) ?? 1)
        const color = (esNeed ? NEED_SHADES : UNLOCK_SHADES)[shadeIdx(depth)].borderColor
        edgeList.push({
          id: `rama-${id}`,
          source,
          target,
          sourceHandle: 'sb',
          targetHandle: 'tt',
          type: 'tree',
          className: 'e-rama',
          data: { pts } satisfies TreeEdgeData,
          interactionWidth: 0, // las flechas no comen clics (el clic pasa al fondo)
          style: { stroke: color, strokeWidth: depth === 1 ? 2.6 : 1.8, opacity: 0.95 },
          markerEnd: flecha(color, depth === 1 ? 18 : 14),
          zIndex: 3,
        })
      }
    }

    return { nodes: [...bandNodes, ...matNodes, ...rotuloNodes], edges: edgeList }
  }, [db, sel, malla, rama, enRama, grafo, bandas])

  const hint = sel
    ? `${nombreDe(db, sel)} · necesitás ${up.size} · habilita ${down.size}${enRama ? ' · clic afuera para volver' : ''}`
    : 'Tocá una materia para ver qué necesita y qué habilita'

  return (
    <div className={`treeview${closing ? ' closing' : ''}`} onAnimationEnd={onExitEnd}>
      <div className="tv-bar">
        <div className="tv-titles">
          <div className="tv-title">Árbol de correlativas</div>
          <div className="tv-hint">{hint}</div>
        </div>
        <button
          className="info-i help"
          type="button"
          aria-label="¿Cómo se usa el árbol de correlativas?"
          onClick={(e) => {
            e.stopPropagation()
            ;(e.currentTarget as HTMLElement).classList.toggle('open')
          }}
        >
          ?
          <span className="tip" role="tooltip">
            <strong>Tocá una materia</strong> y su línea de correlatividades se junta como un
            árbol: <strong>arriba</strong> (violeta) lo que <strong>necesitás</strong> antes,{' '}
            <strong>abajo</strong> (teal) lo que <strong>habilita</strong> después. Más claro =
            más cerca. <strong>Clic afuera</strong> vuelve a la malla completa.
          </span>
        </button>
        <button className="tv-close" onClick={requestClose} aria-label="Cerrar árbol de correlativas">
          ×
        </button>
      </div>

      <div className={`tv-canvas${enRama ? ' rama' : ''}`}>
        {!malla ? (
          <div className="tv-cargando" aria-label="Calculando el árbol…" />
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={(_, n) => {
              // En modo rama, TODO lo que no sea una tarjeta de la rama es "afuera"
              // (bandas, rótulos, materias borrosas del fondo): un clic ahí vuelve a
              // la malla. No confiamos en pointer-events: React Flow pisa el CSS con
              // estilos inline en el wrapper del nodo.
              if (n.type !== 'materia') {
                if (sel) setSel(null)
                return
              }
              if (enRama && rama && !rama.cods.has(n.id)) {
                setSel(null)
                return
              }
              setSel((prev) => (prev === n.id ? null : n.id))
            }}
            onPaneClick={() => setSel(null)}
            onInit={(inst: ReactFlowInstance) => {
              flowRef.current = inst
              // abrir "cerca" mostrando el arranque del plan, a un zoom cómodo
              const vw = window.innerWidth
              const cols = vw < 560 ? 2.6 : 4.6
              const zoom = Math.min(1, Math.max(0.55, vw / (cols * (NODEW + 22))))
              inst.setViewport({ x: 24, y: 24, zoom })
              setFlowListo(true)
            }}
            translateExtent={translateExtent}
            minZoom={0.4}
            maxZoom={1.2}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Controls showInteractive={false} />
            <YearRail bands={bandas} />
            <Panel position="top-right" className="tv-keypanel">
              <div className="tk-row need">
                <span className="tk-dot" />↑ Necesitás <em>antes</em>
              </div>
              <div className="tk-row unlock">
                <span className="tk-dot" />↓ Habilita <em>después</em>
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
