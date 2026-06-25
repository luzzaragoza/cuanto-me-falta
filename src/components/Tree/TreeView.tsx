import { useMemo, useState } from 'react'
import {
  ReactFlow,
  Controls,
  MarkerType,
  Panel,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { plan } from '../../domain/Plan'
import { CORREL } from '../../data/correlativas'
import { nombreDe } from '../../domain/selectors'
import { useDB } from '../../state/store'
import { MateriaNode, type NodeRole } from './MateriaNode'
import { BandNode } from './BandNode'
import { layout } from './layout'

const nodeTypes = { materia: MateriaNode, band: BandNode }

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
const GREY = '#C9C2B5'
const shadeIdx = (lvl: number | undefined) => Math.min(Math.max((lvl ?? 1) - 1, 0), 3)

export function TreeView({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const [sel, setSel] = useState<string | null>(null)

  const up = sel ? plan.chainUp(sel) : new Set<string>()
  const down = sel ? plan.chainDown(sel) : new Set<string>()

  const { nodes, edges } = useMemo(() => {
    const { pos, bands } = layout()
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
      data: { year: b.year, titulo: b.titulo, width: b.width, height: b.height, alt: b.alt },
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

    const edgeList: Edge[] = []
    for (const target of Object.keys(CORREL)) {
      for (const source of CORREL[target]) {
        let kind: 'need' | 'unlock' | 'none' = 'none'
        let depth = 1
        if (sel) {
          const tIsSel = target === sel
          const sIsSel = source === sel
          if ((upSet.has(target) || tIsSel) && upSet.has(source)) {
            kind = 'need'
            depth = Math.max(upLvl.get(source) ?? 1, upLvl.get(target) ?? 0)
          } else if ((downSet.has(source) || sIsSel) && downSet.has(target)) {
            kind = 'unlock'
            depth = Math.max(downLvl.get(source) ?? 0, downLvl.get(target) ?? 1)
          }
        }
        const active = kind !== 'none'
        const color = active
          ? kind === 'need'
            ? NEED_SHADES[shadeIdx(depth)].borderColor
            : UNLOCK_SHADES[shadeIdx(depth)].borderColor
          : GREY
        edgeList.push({
          id: `${source}->${target}`,
          source,
          target,
          type: 'smoothstep',
          animated: active,
          style: {
            stroke: color,
            strokeWidth: active ? 2.5 : 1,
            opacity: sel ? (active ? 0.95 : 0.05) : 0.16,
          },
          markerEnd: active
            ? { type: MarkerType.ArrowClosed, color, width: 18, height: 18 }
            : undefined,
        })
      }
    }

    return { nodes: [...bandNodes, ...matNodes], edges: edgeList }
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
        <button
          className="info-i help"
          type="button"
          aria-label="¿Cómo se usa el árbol?"
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
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.45}
          maxZoom={1.6}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Controls showInteractive={false} />
          <Panel position="top-left" className="tv-keypanel">
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
