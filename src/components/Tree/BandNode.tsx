import type { NodeProps } from '@xyflow/react'
import type { CuatriMark } from './layout'

export interface BandNodeData {
  year: number
  titulo?: string
  width: number
  height: number
  alt: boolean
  cuatris: CuatriMark[]
  [key: string]: unknown
}

/** Banda de fondo de un año. El rótulo del año va aparte (rail sticky); acá se marcan
 *  los cuatrimestres. No interactiva. */
export function BandNode({ data }: NodeProps) {
  const d = data as BandNodeData
  return (
    <div className={'tv-band' + (d.alt ? ' alt' : '')} style={{ width: d.width, height: d.height }}>
      {d.cuatris?.map((c) => (
        <div key={c.n} className="tv-cuatri" style={{ left: c.x, width: c.w }}>
          <span className="tv-cuatri-lbl">{c.n}° cuatrimestre</span>
        </div>
      ))}
    </div>
  )
}
