import type { NodeProps } from '@xyflow/react'

export interface YearLabelData {
  year: number
  titulo?: string
  [key: string]: unknown
}

/** Rótulo de año arriba de cada columna del árbol. */
export function YearLabel({ data }: NodeProps) {
  const d = data as YearLabelData
  return (
    <div className="tv-year">
      <span className="ty-n">{d.year}°</span> año
      {d.titulo && <span className="ty-badge">→ {d.titulo}</span>}
    </div>
  )
}
