import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import type { Step } from './tourPasos'

// Tour sobre los elementos REALES de la pantalla: guía en contexto, no pantallas previas
// que se leen y se olvidan. Los pasos entran por PROP — nació con los del alumno adentro,
// pero la administración necesita los suyos, que son otro momento y otro vocabulario.

// Tour sobre los elementos REALES de la pantalla: guía en contexto, no pantallas
// previas que se leen y se olvidan.
//
// Los pasos entran por PROP. Nació con los del alumno adentro, pero la administración
// necesita los suyos —y son otro momento, otra pantalla y otro vocabulario—, así que el
// componente quedó genérico y cada pantalla trae su guion.

const CARD_W = 300

export function Tour({
  pasos,
  onClose,
  onMark,
}: {
  /** El guion de esta pantalla. */
  pasos: Step[]
  onClose: () => void
  /** Aceptó el empujón final. `directo`: tocó el elemento (su clic ya hace lo suyo). */
  onMark?: (directo?: boolean) => void
}) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = pasos[i]
  const last = i === pasos.length - 1

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
      if (step.ctaSel && t.closest(step.ctaSel)) onMark?.(true)
      else onClose()
    }
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  }, [step.cta, step.ctaSel, onMark, onClose])

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
          {i + 1} / {pasos.length}
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
              <button
                className="tour-next tour-cta"
                type="button"
                onClick={() => (onMark ? onMark() : onClose())}
              >
                {step.ctaTexto ?? 'Empezar'}
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
