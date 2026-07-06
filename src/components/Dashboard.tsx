import type { DB } from '../types'
import { avance } from '../domain/selectors'

interface Props {
  db: DB
  onOpenTree: () => void
  onOpenNotas: () => void
}

const TreeIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="5" rx="1.2" />
    <rect x="3" y="16" width="6" height="5" rx="1.2" />
    <rect x="15" y="16" width="6" height="5" rx="1.2" />
    <path d="M12 8v3M6 16v-2.5h12V16" />
  </svg>
)

const NotesIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </svg>
)

export function Dashboard({ db, onOpenTree, onOpenNotas }: Props) {
  const a = avance(db)
  const seg = (n: number) => ({ width: a.total ? `${(n / a.total) * 100}%` : '0%' })

  return (
    <section className="dash">
      <div className="hero">
        <div className="bignum">
          <div className="stat">
            <span className="num">
              {a.pct}
              <small>%</small>
            </span>
            <span className="cap">aprobado</span>
          </div>

          <div className="bar">
            <i className="b-ap" style={seg(a.aprobadas)} />
            <i className="b-fi" style={seg(a.final)} />
            <i className="b-cu" style={seg(a.cursando)} />
          </div>
        </div>

        <div className="counts">
          <span className="c">
            <i style={{ background: 'var(--ap)' }} />
            {a.aprobadas} aprobadas
          </span>
          <span className="c">
            <i style={{ background: 'var(--fi)' }} />
            {a.final} pend. de final
          </span>
          <span className="c">
            <i style={{ background: 'var(--cu)' }} />
            {a.cursando} cursando
          </span>
          <span className="c">
            <i style={{ background: '#D8D2C6' }} />
            {a.pendientes} pendientes
          </span>
          <span className="c">{a.total} en total</span>
        </div>
      </div>

      <div className="nav-tiles">
        <button className="nav-tile" type="button" onClick={onOpenTree}>
          <TreeIcon />
          <span className="nt-t">Árbol de correlativas</span>
          <span className="nt-r">ver cadenas</span>
        </button>
        <button className="nav-tile" type="button" onClick={onOpenNotas}>
          <NotesIcon />
          <span className="nt-t">Notas</span>
          <span className="nt-r">promedio y notas</span>
        </button>
      </div>
    </section>
  )
}
