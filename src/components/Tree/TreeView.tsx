import { useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { plan } from '../../domain/Plan'
import { CORREL } from '../../data/correlativas'
import { nombreDe } from '../../domain/selectors'
import { useDB } from '../../state/store'
import { MateriaNode, type NodeRole } from './MateriaNode'
import { YearLabel } from './YearLabel'
import { layout } from './layout'

const nodeTypes = { materia: MateriaNode, yearLabel: YearLabel }

const LK = '#6B4FCF' // necesitás (violeta) — lo de ARRIBA / antes
const HB = '#0E8C8C' // habilita (teal) — lo de ABAJO / después
const GREY = '#C9C2B5'

export function TreeView({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const [sel, setSel] = useState<string | null>(null)

  const up = sel ? plan.chainUp(sel) : new Set<string>()
  const down = sel ? plan.chainDown(sel) : new Set<string>()

  const { nodes, edges } = useMemo(() => {
    const { pos, years } = layout()
    const upSet = sel ? plan.chainUp(sel) : new Set<string>()
    const downSet = sel ? plan.chainDown(sel) : new Set<string>()
    const role = (cod: string): NodeRole => {
      if (!sel) return 'normal'
      if (cod === sel) return 'sel'
      if (upSet.has(cod)) return 'need'
      if (downSet.has(cod)) return 'unlock'
      return 'dim'
    }

    const yearNodes: Node[] = plan.anios.map((a, yi) => ({
      id: `year-${yi}`,
      type: 'yearLabel',
      position: years[yi],
      data: { year: a.year, titulo: a.titulo },
      selectable: false,
      draggable: false,
      connectable: false,
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
      },
      draggable: false,
    }))

    const inUp = new Set(upSet)
    const inDown = new Set(downSet)
    if (sel) {
      inUp.add(sel)
      inDown.add(sel)
    }

    const edgeList: Edge[] = []
    for (const target of Object.keys(CORREL)) {
      for (const source of CORREL[target]) {
        let kind: 'need' | 'unlock' | 'none' = 'none'
        if (sel) {
          if (inUp.has(target) && upSet.has(source)) kind = 'need'
          else if (downSet.has(target) && inDown.has(source)) kind = 'unlock'
        }
        const active = kind !== 'none'
        const color = kind === 'need' ? LK : kind === 'unlock' ? HB : GREY
        edgeList.push({
          id: `${source}->${target}`,
          source,
          target,
          type: 'smoothstep',
          animated: active,
          style: {
            stroke: color,
            strokeWidth: active ? 2.5 : 1,
            // en reposo: tenues. al seleccionar: la cadena fuerte y el resto casi invisible.
            opacity: sel ? (active ? 0.95 : 0.05) : 0.16,
          },
          markerEnd: active
            ? { type: MarkerType.ArrowClosed, color, width: 18, height: 18 }
            : undefined,
        })
      }
    }

    return { nodes: [...yearNodes, ...matNodes], edges: edgeList }
  }, [db, sel])

  const hint = sel
    ? `${nombreDe(db, sel)} · necesitás ${up.size} · habilita ${down.size}`
    : 'Tocá una materia para ver su cadena'

  return (
    <div className="treeview">
      <div className="tv-bar">
        <div className="tv-titles">
          <div className="tv-title">Árbol de correlativas</div>
          <div className="tv-hint">{hint}</div>
        </div>
        <div className="tv-legend">
          <span className="tl need">
            <i />↑ Necesitás <em>(antes)</em>
          </span>
          <span className="tl unlock">
            <i />↓ Habilita <em>(después)</em>
          </span>
        </div>
        <button className="tv-close" onClick={onClose} aria-label="Cerrar árbol">
          ×
        </button>
      </div>

      <div className="tv-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, n) => {
            if (n.type === 'materia') setSel((s) => (s === n.id ? null : n.id))
          }}
          onPaneClick={() => setSel(null)}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={26} color="#E7E2D8" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
