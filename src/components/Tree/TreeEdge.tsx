import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export interface TreeEdgeData {
  // 'over' = intra-año (rutea por encima de la fila) · 'nearTarget' = salto de varios años
  // (tramo horizontal pegado al destino) · 'mid' = contigua (a mitad de camino). lane = carril.
  mode?: 'over' | 'nearTarget' | 'mid'
  lane?: number
  [key: string]: unknown
}

/** Arista del árbol: elige el carril del tramo horizontal según el tipo de salto,
 *  para que las flechas no se encimen (ver [[layout]] y TreeView). */
export function TreeEdge({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const d = (data ?? {}) as TreeEdgeData
  const lane = d.lane ?? 0

  let centerY: number | undefined
  if (d.mode === 'over') {
    // intra-año: el tramo horizontal va por ARRIBA de la fila (hueco vacío), escalonado por carril
    centerY = sourceY - (34 + lane * 13)
  } else if (d.mode === 'nearTarget') {
    // salto de varios años: horizontal en el hueco justo sobre el destino (evita cortar la fila del medio)
    centerY = targetY - 30
  } else {
    // contigua: a mitad de camino, con un pequeño escalón por carril para no encimar paralelas
    centerY = (sourceY + targetY) / 2 + (lane - 1.5) * 7
  }

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
    centerY,
  })

  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />
}
