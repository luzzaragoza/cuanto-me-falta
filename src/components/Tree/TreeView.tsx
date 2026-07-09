import { useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Controls,
  MarkerType,
  Panel,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { plan } from '../../domain/Plan'
import { nombreDe } from '../../domain/selectors'
import { useDB } from '../../state/store'
import { useExitAnimation } from '../../hooks/useExitAnimation'
import { MateriaNode, type NodeRole } from './MateriaNode'
import { BandNode } from './BandNode'
import { TreeEdge } from './TreeEdge'
import { YearRail } from './YearRail'
import { layout, YEARY, NODEX } from './layout'

const nodeTypes = { materia: MateriaNode, band: BandNode }
const edgeTypes = { tree: TreeEdge }

// Escalas de color por profundidad: directas claritas → más lejos, más oscuro (texto blanco en los oscuros).
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

export function TreeView({ onClose, focus }: { onClose: () => void; focus: string | null }) {
  const db = useDB()
  const [sel, setSel] = useState<string | null>(focus)
  const { closing, requestClose, onExitEnd } = useExitAnimation(onClose)
  const lay = useMemo(() => layout(), [])

  // Límite de paneo: no dejar arrastrar el árbol hasta el vacío (antes se podía
  // perder de vista y quedaba todo en blanco). Es el bounding box + un margen chico.
  const translateExtent = useMemo(() => {
    const M = 300
    const first = lay.bands[0]
    const last = lay.bands[lay.bands.length - 1]
    const top = first ? first.y : 0
    const bottom = last ? last.y + last.height : 900
    return [
      [-M, top - M],
      [lay.width + M, bottom + M],
    ] as [[number, number], [number, number]]
  }, [lay])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose])

  const up = sel ? plan.chainUp(sel) : new Set<string>()
  const down = sel ? plan.chainDown(sel) : new Set<string>()

  const { nodes, edges } = useMemo(() => {
    const { pos, bands } = lay
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

    const bandNodes: Node[] = bands.map((b, i) => ({
      id: `band-${i}`,
      type: 'band',
      position: { x: b.x, y: b.y },
      data: {
        year: b.year,
        titulo: b.titulo,
        width: b.width,
        height: b.height,
        alt: b.alt,
        cuatris: b.cuatris,
      },
      selectable: false,
      draggable: false,
      connectable: false,
      zIndex: 0,
    }))

    const matNodes: Node[] = plan.materias().map((m) => ({
      id: m.cod,
      type: 'materia',
      position: pos[m.cod],
      data: {
        cod: m.cod,
        nom: nombreDe(db, m.cod),
        estado: db.states[m.cod] ?? 'pendiente',
        role: role(m.cod),
        tint: tint(m.cod),
      },
      draggable: false,
      zIndex: 1,
    }))

    // Aristas: SOLO se dibuja la cadena de la materia seleccionada. En reposo no hay
    // ninguna → el árbol queda limpio (antes la maraña tenue cargaba mucho lo visual).
    // El ruteo elige por dónde va el tramo horizontal según cuántos años salta el vínculo,
    // para que las flechas no se encimen ni corten filas de nodos:
    //  · intra-año (salto 0) → 'over': por ARRIBA de la fila (hueco vacío), en carriles.
    //  · contigua (salto 1)  → 'mid': a mitad de camino, escalonada por columna de origen.
    //  · salto ≥2 años       → 'nearTarget': horizontal pegado al destino (no cruza la fila del medio).
    const overLane = new Map<number, number>() // carril por fila para las intra-año
    const edgeList: Edge[] = []
    if (sel) {
      for (const { cod: target, requiere: source } of plan.correlativas()) {
        let kind: 'need' | 'unlock' | 'none' = 'none'
        let depth = 1
        const tIsSel = target === sel
        const sIsSel = source === sel
        if ((upSet.has(target) || tIsSel) && upSet.has(source)) {
          kind = 'need'
          depth = Math.max(upLvl.get(source) ?? 1, upLvl.get(target) ?? 0)
        } else if ((downSet.has(source) || sIsSel) && downSet.has(target)) {
          kind = 'unlock'
          depth = Math.max(downLvl.get(source) ?? 0, downLvl.get(target) ?? 1)
        }
        if (kind === 'none') continue // fuera de la cadena → no se dibuja

        const color =
          kind === 'need'
            ? NEED_SHADES[shadeIdx(depth)].borderColor
            : UNLOCK_SHADES[shadeIdx(depth)].borderColor

        const sy = pos[source]?.y ?? 0
        const ty = pos[target]?.y ?? 0
        const rowSpan = Math.round((ty - sy) / YEARY)
        let mode: 'over' | 'nearTarget' | 'mid'
        let sourceHandle: string
        let lane: number
        if (rowSpan <= 0) {
          mode = 'over'
          sourceHandle = 'st'
          lane = overLane.get(sy) ?? 0
          overLane.set(sy, lane + 1)
        } else {
          sourceHandle = 'sb'
          if (rowSpan >= 2) {
            mode = 'nearTarget'
            lane = 0
          } else {
            mode = 'mid'
            lane = Math.round((pos[source]?.x ?? 0) / NODEX) % 4
          }
        }

        edgeList.push({
          id: `${source}->${target}`,
          source,
          target,
          sourceHandle,
          targetHandle: 'tt',
          type: 'tree',
          data: { mode, lane },
          animated: true,
          style: { stroke: color, strokeWidth: 2.5, opacity: 0.95 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
        })
      }
    }

    return { nodes: [...bandNodes, ...matNodes], edges: edgeList }
  }, [db, sel, lay])

  const hint = sel
    ? `${nombreDe(db, sel)} · necesitás ${up.size} · habilita ${down.size}`
    : 'Tocá una materia para ver su cadena'

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
            <strong>Tocá una materia</strong> para ver su cadena. <strong>Arriba</strong> (violeta) lo
            que <strong>necesitás</strong> antes; <strong>abajo</strong> (teal) lo que{' '}
            <strong>habilita</strong>. Más claro = más cerca, más oscuro = más lejos. Zoom con la
            rueda y arrastrá para moverte.
          </span>
        </button>
        <button className="tv-close" onClick={requestClose} aria-label="Cerrar árbol de correlativas">
          ×
        </button>
      </div>

      <div className="tv-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, n) => {
            if (n.type === 'materia') setSel((s) => (s === n.id ? null : n.id))
          }}
          onPaneClick={() => setSel(null)}
          onInit={(inst: ReactFlowInstance) => {
            if (focus && lay.pos[focus]) {
              const p = lay.pos[focus]
              inst.setCenter(p.x + 100, p.y + 26, { zoom: 1.05, duration: 600 })
              return
            }
            // Sin foco: abrir "cerca" mostrando el arranque del plan (año 1), a un zoom
            // cómodo según el ancho de pantalla. Evita el fitView lejano con mucho blanco.
            const vw = window.innerWidth
            const cols = vw < 560 ? 2.6 : 4.6 // columnas visibles al abrir (mobile vs pc)
            const zoom = Math.min(1, Math.max(0.55, vw / (cols * NODEX)))
            const topY = lay.bands[0]?.y ?? 0
            // 92 = aire arriba (el árbol no pegado al techo ni a la leyenda)
            inst.setViewport({ x: 64, y: 92 - topY * zoom, zoom })
          }}
          translateExtent={translateExtent}
          minZoom={0.45}
          maxZoom={1.2}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Controls showInteractive={false} />
          <YearRail bands={lay.bands} />
          <Panel position="top-right" className="tv-keypanel">
            <div className="tk-row need">
              <span className="tk-dot" />↑ Necesitás <em>antes</em>
            </div>
            <div className="tk-row unlock">
              <span className="tk-dot" />↓ Habilita <em>después</em>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  )
}
