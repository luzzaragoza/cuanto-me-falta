import type { Estado } from '../types'

const TICK: Record<Estado, string> = {
  pendiente: '',
  cursando: '•',
  final: '◐',
  aprobada: '✓',
}

interface Props {
  cod: string
  nom: string
  estado: Estado
  disponible: boolean
  abierto: boolean
  onOpen: (anchor: HTMLElement) => void
}

export function MateriaRow({ cod, nom, estado, disponible, abierto, onOpen }: Props) {
  const cls = ['mat', estado, disponible ? 'avail' : '', abierto ? 'open' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      onClick={(e) => onOpen(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(e.currentTarget)
        }
      }}
    >
      <span className="tick">{TICK[estado]}</span>
      <span className="info">
        <span className="cod">{cod.startsWith('CUST') ? '—' : cod}</span>
        <span className="nom">{nom}</span>
      </span>
      {disponible && <span className="avail-tag">disponible</span>}
    </div>
  )
}
