import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'

interface Step {
  sel: string // selector del elemento real a resaltar
  titulo: string
  texto: string
  cta?: boolean // paso de cierre: el botón primario invita a marcar, no a avanzar
}

// Tour sobre los elementos REALES de la app (guía en contexto, no pantallas previas).
// Cierra sobre la 1ª materia con una llamada a la acción: el dato del embudo dice
// que el 64% entra y no marca nada, así que el tour no termina explicando — termina
// empujando el primer toque (la métrica de activación del Gate A).
const STEPS: Step[] = [
  {
    sel: '#plan .mat',
    titulo: 'Marcá tus materias',
    texto: 'Tocá una materia para poner su estado: pendiente, cursando, pend. de final o aprobada.',
  },
  {
    sel: '#plan .corr-btn',
    titulo: 'Correlativas',
    texto: 'Este botón te muestra qué necesitás antes de una materia y qué habilita después.',
  },
  {
    sel: '.nav-tiles .nav-tile:first-child',
    titulo: 'Árbol de correlativas',
    texto: 'Tocá una materia y vas a ver toda su cadena: lo que necesitás y lo que habilita.',
  },
  {
    sel: '.nav-tiles .nav-tile:last-child',
    titulo: 'Notas',
    texto: 'Cargá la nota de las materias aprobadas y mirá tu promedio.',
  },
  {
    sel: '.head .actions',
    titulo: 'Opciones',
    texto: 'Exportá un PDF o un backup, cambiá de carrera y más.',
  },
  {
    sel: '#plan .mat',
    titulo: '¡Ahora probá vos!',
    texto: 'Empezá por esta: tocala y marcá cómo la llevás. Tu avance se calcula solo.',
    cta: true,
  },
]

const CARD_W = 300

export function Tour({
  onClose,
  onMark,
}: {
  onClose: () => void
  /** Aceptó el empujón final. `directo`: tocó la materia (el clic ya abre su selector). */
  onMark: (directo?: boolean) => void
}) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(step.sel)
    if (!el) {
      // el target no existe: saltamos el paso (o cerramos si era el último)
      if (last) onClose()
      else setI((n) => n + 1)
      return
    }
    el.scrollIntoView({ block: 'center', inline: 'center' })
    const measure = () => setRect(el.getBoundingClientRect())
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [i, step.sel, last, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Paso de cierre: el overlay deja pasar los clics (ver .tour.cta en CSS) para que
  // la materia resaltada se toque DIRECTO — el spotlight invita a tocarla, así que
  // tocarla tiene que funcionar. Captura: si el clic cayó en una materia, es el
  // nudge aceptado (el propio clic abre su selector); cualquier otro clic fuera de
  // la tarjeta solo despide el tour y deja que el clic haga lo suyo.
  useEffect(() => {
    if (!step.cta) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || t.closest('.tour-card')) return
      if (t.closest('.mat')) onMark(true)
      else onClose()
    }
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  }, [step.cta, onMark, onClose])

  if (!rect) return null

  const pad = 8
  const hole = {
    left: rect.left - pad,
    top: rect.top - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
  const below = rect.top < window.innerHeight / 2
  const left = Math.max(12, Math.min(hole.left, window.innerWidth - CARD_W - 12))
  const cardStyle: CSSProperties = below
    ? { left, top: hole.top + hole.height + 12 }
    : { left, bottom: window.innerHeight - hole.top + 12 }

  return (
    <div className={'tour' + (step.cta ? ' cta' : '')} role="dialog" aria-label="Tutorial">
      <div
        className="tour-hole"
        style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }}
      />
      <div className="tour-card" style={cardStyle}>
        <div className="tour-step">
          {i + 1} / {STEPS.length}
        </div>
        <div className="tour-title">{step.titulo}</div>
        <p className="tour-text">{step.texto}</p>
        <div className="tour-actions">
          <button className="tour-skip" type="button" onClick={onClose}>
            Saltar
          </button>
          <div className="tour-nav">
            {i > 0 && (
              <button className="tour-prev" type="button" onClick={() => setI(i - 1)}>
                Atrás
              </button>
            )}
            {step.cta ? (
              <button className="tour-next tour-cta" type="button" onClick={() => onMark()}>
                Marcar una materia
              </button>
            ) : (
              <button
                className="tour-next"
                type="button"
                onClick={() => (last ? onClose() : setI(i + 1))}
              >
                {last ? 'Listo' : 'Siguiente'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
