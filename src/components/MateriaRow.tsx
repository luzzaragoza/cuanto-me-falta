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
  onClick: () => void
}

export function MateriaRow({ cod, nom, estado, disponible, onClick }: Props) {
  const cls = ['mat', estado, disponible ? 'avail' : ''].filter(Boolean).join(' ')
  return (
    <div className={cls} role="button" tabIndex={0} onClick={onClick}>
      <span className="tick">{TICK[estado]}</span>
      <span className="info">
        <span className="cod">{cod.startsWith('CUST') ? '—' : cod}</span>
        <span className="nom">{nom}</span>
      </span>
      {disponible && <span className="avail-tag">disponible</span>}
    </div>
  )
}
