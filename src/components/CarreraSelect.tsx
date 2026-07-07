import { useEffect, useRef, useState } from 'react'
import { PLANES, nombreUniversidad } from '../data/planes'

const Chevron = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
)
const Check = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

/** Dropdown custom para elegir la carrera (más lindo que el <select> nativo). */
export function CarreraSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const actual = PLANES.find((p) => p.id === value) ?? PLANES[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={'cselect' + (open ? ' open' : '')} ref={ref}>
      <button
        type="button"
        className="cselect-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="cselect-val">{actual.carrera}</span>
        <span className="cselect-chev">
          <Chevron />
        </span>
      </button>
      {open && (
        <ul className="cselect-list" role="listbox">
          {PLANES.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={p.id === value}
                className={'cselect-opt' + (p.id === value ? ' sel' : '')}
                onClick={() => {
                  onChange(p.id)
                  setOpen(false)
                }}
              >
                <span className="cselect-opt-tx">
                  <span className="cselect-opt-name">{p.carrera}</span>
                  <span className="cselect-opt-meta">
                    {nombreUniversidad(p.universidad)} · Plan {p.codigo}
                  </span>
                </span>
                {p.id === value && (
                  <span className="cselect-opt-chk">
                    <Check />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
