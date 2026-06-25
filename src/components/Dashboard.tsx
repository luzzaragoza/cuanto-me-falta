import type { DB } from '../types'
import { avance, hitos, promedio } from '../domain/selectors'

interface Props {
  db: DB
  onOpenNotas: () => void
  notasResaltado: boolean
}

export function Dashboard({ db, onOpenNotas, notasResaltado }: Props) {
  const a = avance(db)
  const prom = promedio(db)
  const ms = hitos(db)
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
          <div className="sep" />
          <div className={'stat' + (notasResaltado ? ' hl' : '')}>
            <span className="num">{prom.valor ?? '—'}</span>
            <span className="cap">
              {prom.valor != null
                ? `promedio · ${prom.conNota} ${prom.conNota === 1 ? 'materia con nota' : 'materias con nota'}`
                : 'promedio'}
              <button className="nota-link" onClick={onOpenNotas}>
                editar notas
              </button>
            </span>
          </div>
        </div>

        <div className="bar">
          <i className="b-ap" style={seg(a.aprobadas)} />
          <i className="b-fi" style={seg(a.final)} />
          <i className="b-cu" style={seg(a.cursando)} />
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

      <div className="miles">
        {ms.map((h, i) => (
          <div className={`mile ${h.ok ? 'ok' : ''}`} key={h.titulo}>
            <span className="mile-n">{i + 1}</span>
            <span className="mile-t">{h.titulo}</span>
            <span className="mile-r">
              {h.ok ? '¡Conseguido!' : `${h.falta} materias para el título`}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
