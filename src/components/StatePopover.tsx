import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { DB, Estado } from '../types'
import { plan } from '../domain/Plan'
import { nombreDe, previasParaEstado } from '../domain/selectors'
import { store } from '../state/store'
import { toast } from '../lib/toast'

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
  onVerArbol: (cod: string) => void
}

export function StatePopover({ cod, anchor, db, onClose, onVerArbol }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const estado: Estado = db.states[cod] ?? 'pendiente'
  const special = plan.isSpecial(cod)
  const isOpt = plan.isOpt(cod)

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
    // El aviso de previas ahora es un toast flotante: no atamos el popover a mostrarlo.
    if (!special) {
      const faltan = previasParaEstado(store.getSnapshot(), cod, k)
      if (faltan.length > 0) {
        const nombres = faltan.map((p) => nombreDe(db, p)).join(', ')
        const verbo = k === 'aprobada' ? 'aprobar' : 'cursar'
        const falta = faltan.length > 1 ? 'te faltan' : 'te falta'
        toast.show(`Para ${verbo} ${nombreDe(db, cod)} ${falta}: ${nombres}.`, 'warn', {
          label: 'Ver árbol de correlativas',
          run: () => onVerArbol(cod),
        })
      }
    }
    onClose()
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

      {special && (
        <div className="sp-note">
          Se habilita por <b>requisito especial</b> (por año o % de carrera). Consultá en UADE.
        </div>
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
