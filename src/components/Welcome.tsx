import { useEffect, useState } from 'react'
import { store } from '../state/store'

// Marca en serif de sistema (Georgia) para que el ¿ del logo sea idéntico al
// del favicon / OG (generados con esa fuente). El wordmark de abajo sí usa Fraunces.
const LogoBadge = () => (
  <svg viewBox="0 0 100 100" width="60" height="60" aria-hidden="true">
    <rect x="4" y="4" width="92" height="92" rx="22" fill="#c39200" />
    <text
      x="50"
      y="76"
      textAnchor="middle"
      fontFamily="Georgia, 'Times New Roman', serif"
      fontSize="74"
      fontWeight="700"
      fill="#fff"
    >
      ¿
    </text>
  </svg>
)

const EstadosIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8 12l3 3 5-6" />
  </svg>
)
const CorrIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="5" rx="1.2" />
    <rect x="3" y="16" width="6" height="5" rx="1.2" />
    <rect x="15" y="16" width="6" height="5" rx="1.2" />
    <path d="M12 8v3M6 16v-2.5h12V16" />
  </svg>
)
const AvanceIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16" />
    <path d="M7 20v-6M12 20V8M17 20v-9" />
  </svg>
)

const FEATURES = [
  { Icon: EstadosIcon, t: 'Estados', d: 'marcá cada materia' },
  { Icon: CorrIcon, t: 'Correlativas', d: 'mirá qué habilita qué' },
  { Icon: AvanceIcon, t: 'Avance', d: 'cuánto te falta para el título' },
]

/** Pantalla de bienvenida de primera visita: marca + qué es + tu nombre. */
export function Welcome({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')

  const start = () => {
    store.setPerfil({ name: name.trim(), photo: '' })
    onClose()
  }
  // "entrar sin nombre": marcamos el perfil como visto (vacío) para no re-preguntar
  const skip = () => {
    store.setPerfil({ name: '', photo: '' })
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="welcome">
      <div className="welcome-card">
        <span className="w-logo">
          <LogoBadge />
        </span>
        <h1 className="w-brand">
          <span className="q">¿</span>Cuánto me falta<span className="q">?</span>
        </h1>
        <p className="w-tag">Seguí el avance de tu carrera de un vistazo.</p>

        <div className="w-features">
          {FEATURES.map(({ Icon, t, d }) => (
            <div className="w-feat" key={t}>
              <span className="w-feat-ic">
                <Icon />
              </span>
              <span className="w-feat-tx">
                <b>{t}</b>
                <small>{d}</small>
              </span>
            </div>
          ))}
        </div>

        <div className="w-start">
          <label htmlFor="w-name">¿Cómo te llamás?</label>
          <div className="w-start-row">
            <input
              id="w-name"
              type="text"
              placeholder="Tu nombre"
              maxLength={40}
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  start()
                }
              }}
            />
            <button className="btn" onClick={start}>
              Empezá →
            </button>
          </div>
        </div>

        <button className="lnk w-skip" onClick={skip}>
          Entrar sin nombre
        </button>
        <p className="w-priv">Tus datos quedan solo en este dispositivo. La foto la sumás después.</p>
      </div>
    </div>
  )
}
