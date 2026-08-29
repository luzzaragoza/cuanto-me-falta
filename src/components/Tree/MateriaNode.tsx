import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Estado } from '../../types'

export type NodeRole = 'normal' | 'sel' | 'need' | 'unlock' | 'dim'

/** En el editor de planes: qué papel juega esta materia en la conexión que se está armando. */
export type EditRole = 'objetivo' | 'elegible' | 'conectada' | 'apagada'

export interface MateriaNodeData {
  cod: string
  nom: string
  estado: Estado
  role: NodeRole
  tint?: CSSProperties // tinte por profundidad (need/unlock); undefined para el resto
  edit?: EditRole // solo en el editor; en la app del alumno viene undefined
  editDir?: 'anterior' | 'posterior' // el color de "ya conectada" sigue el sentido activo
  /**
   * Por qué esta materia no se puede conectar. Va como `title` nativo: aparece al dejar
   * el mouse encima, sin tapar nada ni robar el foco. Intentar conectar y que "no pase
   * nada" es la peor respuesta posible — al menos hay que decir por qué.
   */
  motivo?: string
  [key: string]: unknown
}

/** Nodo de materia en el árbol: código + nombre, color por estado y por rol/profundidad. */
export function MateriaNode({ data }: NodeProps) {
  const d = data as MateriaNodeData
  return (
    <div
      className={`tnode ${d.estado} role-${d.role}${d.edit ? ` edit-${d.edit}` : ''}${
        d.editDir ? ` dir-${d.editDir}` : ''
      }`}
      style={d.tint}
      title={d.motivo}
    >
      {/* El flujo es siempre descendente: entra por arriba, sale por abajo. Centrados,
          así una correlativa entre columnas alineadas es una vertical perfecta. */}
      <Handle id="tt" type="target" position={Position.Top} isConnectable={false} />
      <div className="tn-cod">{d.cod.startsWith('CUST') ? '—' : d.cod}</div>
      <div className="tn-nom">{d.nom}</div>
      <Handle id="sb" type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  )
}
