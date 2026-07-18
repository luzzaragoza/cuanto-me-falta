import type { NodeProps } from '@xyflow/react'
import type { CuatriMark } from './bandas'

export interface BandNodeData {
  year: number
  width: number
  height: number
  alt: boolean
  cuatris: CuatriMark[]
  [key: string]: unknown
}

/** Banda de fondo de un año (abarca sus filas de cuatrimestre). El rótulo del año va
 *  aparte (rail sticky); acá se marca la franja de cada cuatrimestre. No interactiva. */
export function BandNode({ data }: NodeProps) {
  const d = data as BandNodeData
  return (
    <div className={'tv-band' + (d.alt ? ' alt' : '')} style={{ width: d.width, height: d.height }}>
      {d.cuatris?.map((c) => (
        <div
          key={c.n}
          className={'tv-cuatri' + (c.n % 2 === 0 ? ' alt' : '')}
          style={{ top: c.y, height: c.h }}
        >
          <span className="tv-cuatri-lbl">{c.n}° cuatrimestre</span>
        </div>
      ))}
    </div>
  )
}
