import type { NodeProps } from '@xyflow/react'

export interface BandNodeData {
  year: number
  titulo?: string
  width: number
  height: number
  alt: boolean
  [key: string]: unknown
}

/** Banda de fondo de un año, con el rótulo fijo a la izquierda. No interactiva. */
export function BandNode({ data }: NodeProps) {
  const d = data as BandNodeData
  return (
    <div
      className={'tv-band' + (d.alt ? ' alt' : '')}
      style={{ width: d.width, height: d.height }}
    >
      <div className="tv-band-label">
        <b>{d.year}°</b> año{d.titulo && <em>→ {d.titulo}</em>}
      </div>
    </div>
  )
}
