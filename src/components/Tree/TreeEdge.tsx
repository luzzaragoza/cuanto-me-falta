import { BaseEdge, type EdgeProps } from '@xyflow/react'
import type { Punto } from '../../lib/arbolLayout'

export interface TreeEdgeData {
  /** Polilínea absoluta calculada por ELK (arbolLayout). Sin ella: recta directa. */
  pts?: Punto[]
  [key: string]: unknown
}

/** Camino ortogonal con esquinas redondeadas a partir de los puntos de quiebre. */
function orthPath(pts: Punto[], r = 10): string {
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]
    const c = pts[i]
    const b = pts[i + 1]
    const inX = Math.sign(c.x - a.x)
    const inY = Math.sign(c.y - a.y)
    const outX = Math.sign(b.x - c.x)
    const outY = Math.sign(b.y - c.y)
    if (inX === outX && inY === outY) continue // colineal: no hay esquina
    // radio acotado por la mitad del tramo más corto (evita rulos en tramos chicos)
    const rr = Math.min(r, Math.hypot(c.x - a.x, c.y - a.y) / 2, Math.hypot(b.x - c.x, b.y - c.y) / 2)
    d += ` L ${c.x - inX * rr} ${c.y - inY * rr} Q ${c.x} ${c.y} ${c.x + outX * rr} ${c.y + outY * rr}`
  }
  const fin = pts[pts.length - 1]
  return `${d} L ${fin.x} ${fin.y}`
}

/** Arista del árbol: dibuja la polilínea que decidió el motor de layout (ELK).
 *  El ruteo ya viene garantizado sin cruces ni encimadas (invariantes en CI);
 *  acá solo se pinta. Si no hay puntos (no debería pasar), recta y listo. */
export function TreeEdge({ sourceX, sourceY, targetX, targetY, markerEnd, style, data }: EdgeProps) {
  const pts = (data as TreeEdgeData | undefined)?.pts
  const camino =
    pts && pts.length >= 2 ? orthPath(pts) : `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
  return <BaseEdge path={camino} markerEnd={markerEnd} style={style} />
}
