import type { Estado } from '../types'

const TICK: Record<Estado, string> = {
  pendiente: '',
  cursando: '•',
  final: '◐',
  aprobada: '✓',
}

const TreeIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="5" rx="1.2" />
    <rect x="3" y="16" width="6" height="5" rx="1.2" />
    <rect x="15" y="16" width="6" height="5" rx="1.2" />
    <path d="M12 8v3M6 16v-2.5h12V16" />
  </svg>
)

interface Props {
  id: string
  cod: string
  nom: string
  estado: Estado
  disponible: boolean
  abierto: boolean
  flash: boolean
  corrAbierto: boolean
  onOpen: (anchor: HTMLElement) => void
  onToggleCorr: () => void
}

export function MateriaRow({
  id,
  cod,
  nom,
  estado,
  disponible,
  abierto,
  flash,
  corrAbierto,
  onOpen,
  onToggleCorr,
}: Props) {
  const cls = [
    'mat',
    estado,
    disponible ? 'avail' : '',
    abierto ? 'open' : '',
    flash ? 'flash' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      id={id}
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
      <button
        className={'corr-btn' + (corrAbierto ? ' on' : '')}
        type="button"
        aria-label="Ver correlativas"
        aria-pressed={corrAbierto}
        title="Correlativas"
        onClick={(e) => {
          e.stopPropagation()
          onToggleCorr()
        }}
      >
        <TreeIcon />
      </button>
    </div>
  )
}
