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
      {/* Lo que ENTRA va a la izquierda (tt) y lo que SALE a la derecha (st/sb): así una flecha
          que llega y otra que arranca del mismo nodo no se ven colineales (se lee ida vs vuelta). */}
      <Handle id="tt" type="target" position={Position.Top} isConnectable={false} style={{ left: '32%' }} />
      <Handle id="st" type="source" position={Position.Top} isConnectable={false} style={{ left: '68%' }} />
      <div className="tn-cod">{d.cod.startsWith('CUST') ? '—' : d.cod}</div>
      <div className="tn-nom">{d.nom}</div>
      {/* abajo: sale lo que habilita en años posteriores (a la derecha) */}
      <Handle id="sb" type="source" position={Position.Bottom} isConnectable={false} style={{ left: '68%' }} />
    </div>
  )
}
