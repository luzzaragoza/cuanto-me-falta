import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { DB, Estado } from '../types'
import { plan } from '../domain/Plan'
import { nombreDe, previasFaltantes } from '../domain/selectors'
import { store } from '../state/store'

const OPTS: { k: Estado; label: string; desc: string }[] = [
  { k: 'pendiente', label: 'Pendiente', desc: 'Todavía no la empecé' },
  { k: 'cursando', label: 'Cursando', desc: 'La estoy cursando ahora' },
  { k: 'final', label: 'Pendiente de final', desc: 'Aprobé la cursada, me falta rendir' },
  { k: 'aprobada', label: 'Aprobada', desc: 'Final aprobado' },
]

const TICK: Record<Estado, string> = { pendiente: '', cursando: '•', final: '◐', aprobada: '✓' }

const Check = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

interface Props {
  cod: string
  anchor: HTMLElement
  db: DB
  onClose: () => void
}

export function StatePopover({ cod, anchor, db, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const estado: Estado = db.states[cod] ?? 'pendiente'
  const special = plan.isSpecial(cod)
  const isOpt = plan.isOpt(cod)
  const faltan =
    (estado === 'cursando' || estado === 'aprobada') && !special ? previasFaltantes(db, cod) : []

  const reposition = useCallback(() => {
    const pop = ref.current
    if (!pop) return
    const r = anchor.getBoundingClientRect()
    const M = 10
    const pw = pop.offsetWidth
    const ph = pop.offsetHeight
    let left = Math.max(M, Math.min(r.left, window.innerWidth - M - pw))
    let top = r.bottom + 6
    if (top + ph > window.innerHeight - M) top = Math.max(M, r.top - 6 - ph)
    pop.style.left = `${left}px`
    pop.style.top = `${top}px`
  }, [anchor])

  // reubicar al montar y cuando cambia el alto (aparece nota/aviso/rename)
  useLayoutEffect(reposition, [reposition, estado])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t)) return
      if (anchor.contains(t)) return // el toggle del row lo maneja App
      onClose()
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [reposition, onClose, anchor])

  const select = (k: Estado) => {
    store.setEstado(cod, k)
    const faltanAhora = previasFaltantes(store.getSnapshot(), cod).length > 0
    const keepOpen = k === 'aprobada' || (k === 'cursando' && !special && faltanAhora)
    if (!keepOpen) onClose()
  }

  return (
    <div className="spop spop-in" ref={ref} role="menu">
      <div className="sp-head">Estado de la materia</div>

      {OPTS.map((o) => (
        <button
          key={o.k}
          className={'sp-opt' + (estado === o.k ? ' sel' : '')}
          onClick={() => select(o.k)}
        >
          <span className={'sp-dot ' + o.k}>{TICK[o.k]}</span>
          <span className="sp-name">
            {o.label}
            <small>{o.desc}</small>
          </span>
          <span className="sp-chk">
            <Check />
          </span>
        </button>
      ))}

      {faltan.length > 0 && (
        <div className="sp-note warn">
          Ojo: te faltan previas — {faltan.map((p) => nombreDe(db, p)).join(', ')}.
        </div>
      )}

      {special && (
        <div className="sp-note">
          Se habilita por <b>requisito especial</b> (por año o % de carrera). Consultá en UADE.
        </div>
      )}

      {estado === 'aprobada' && (
        <>
          <div className="sp-sep" />
          <div className="sp-nota">
            <label htmlFor="sp-nota-in">
              Nota final <span>(opcional)</span>
            </label>
            <input
              id="sp-nota-in"
              type="number"
              min={1}
              max={10}
              step={1}
              inputMode="numeric"
              placeholder="—"
              defaultValue={db.notas[cod] ?? ''}
              onChange={(e) =>
                store.setNota(cod, e.target.value === '' ? null : parseFloat(e.target.value))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                  onClose()
                }
              }}
            />
          </div>
        </>
      )}

      {isOpt && (
        <>
          <div className="sp-sep" />
          <div className="sp-nota sp-rename">
            <label htmlFor="sp-opt-in">
              Nombre de la optativa <span>(editable)</span>
            </label>
            <input
              id="sp-opt-in"
              type="text"
              maxLength={48}
              placeholder="Optativa…"
              defaultValue={db.optNames[cod] ?? ''}
              onChange={(e) => store.setOptName(cod, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                  onClose()
                }
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
