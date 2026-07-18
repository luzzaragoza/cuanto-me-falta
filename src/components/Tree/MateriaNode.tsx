import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Estado } from '../../types'

export type NodeRole = 'normal' | 'sel' | 'need' | 'unlock' | 'dim'

export interface MateriaNodeData {
  cod: string
  nom: string
  estado: Estado
  role: NodeRole
  tint?: CSSProperties // tinte por profundidad (need/unlock); undefined para el resto
  [key: string]: unknown
}

/** Nodo de materia en el árbol: código + nombre, color por estado y por rol/profundidad. */
export function MateriaNode({ data }: NodeProps) {
  const d = data as MateriaNodeData
  return (
    <div className={`tnode ${d.estado} role-${d.role}`} style={d.tint}>
      {/* El flujo es siempre descendente: entra por arriba, sale por abajo. Centrados,
          así una correlativa entre columnas alineadas es una vertical perfecta. */}
      <Handle id="tt" type="target" position={Position.Top} isConnectable={false} />
      <div className="tn-cod">{d.cod.startsWith('CUST') ? '—' : d.cod}</div>
      <div className="tn-nom">{d.nom}</div>
      <Handle id="sb" type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  )
}
