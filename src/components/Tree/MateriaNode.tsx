import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Estado } from '../../types'

export type NodeRole = 'normal' | 'sel' | 'need' | 'unlock' | 'dim'

export interface MateriaNodeData {
  cod: string
  nom: string
  estado: Estado
  role: NodeRole
  [key: string]: unknown
}

/** Nodo de materia en el árbol: código + nombre, color por estado y por rol en la cadena. */
export function MateriaNode({ data }: NodeProps) {
  const d = data as MateriaNodeData
  return (
    <div className={`tnode ${d.estado} role-${d.role}`}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="tn-cod">{d.cod.startsWith('CUST') ? '—' : d.cod}</div>
      <div className="tn-nom">{d.nom}</div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  )
}
