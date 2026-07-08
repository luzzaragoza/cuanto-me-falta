import { useDB } from '../state/store'
import {
  avance,
  avancePorAnio,
  hitos,
  iniciales,
  materiasEnEstado,
  nombreDe,
  promedio,
} from '../domain/selectors'
import { plan } from '../domain/Plan'
import { nombreUniversidad } from '../data/planes'

/** Resumen de una carilla para exportar a PDF (visible solo al imprimir). */
export function PrintSummary() {
  const db = useDB()
  const a = avance(db)
  const prom = promedio(db)
  const perfil = db.profile
  const nombre = perfil?.name?.trim() || 'Mi plan de carrera'
  const seg = (n: number) => ({ width: a.total ? `${(n / a.total) * 100}%` : '0%' })
  const fecha = new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const cursando = materiasEnEstado(db, 'cursando')
  const final = materiasEnEstado(db, 'final')

  return (
    <div id="print-summary">
      <header className="ps-head">
        <div className="ps-av">
          {perfil?.photo ? <img src={perfil.photo} alt="" /> : <span>{iniciales(perfil?.name) || '·'}</span>}
        </div>
        <div className="ps-id">
          <div className="ps-name">{nombre}</div>
          <div className="ps-sub">
            {plan.carrera} · {nombreUniversidad(plan.def.universidad)} — Plan {plan.def.codigo}
          </div>
        </div>
      </header>

      <div className="ps-stats">
        <div className="ps-stat">
          <span className="ps-stat-n">
            {a.pct}
            <i>%</i>
          </span>
          <span className="ps-stat-l">aprobado</span>
        </div>
        <div className="ps-stat">
          <span className="ps-stat-n">{prom.valor ?? '—'}</span>
          <span className="ps-stat-l">promedio</span>
        </div>
        <div className="ps-stat">
          <span className="ps-stat-n">
            {a.total - a.aprobadas}
            <i>/{a.total}</i>
          </span>
          <span className="ps-stat-l">te faltan</span>
        </div>
      </div>

      <div className="ps-bar">
        <i className="s-ap" style={seg(a.aprobadas)} />
        <i className="s-fi" style={seg(a.final)} />
        <i className="s-cu" style={seg(a.cursando)} />
      </div>
      <div className="ps-legend">
        <span>
          <i className="d-ap" />
          {a.aprobadas} aprobadas
        </span>
        <span>
          <i className="d-fi" />
          {a.final} pend. de final
        </span>
        <span>
          <i className="d-cu" />
          {a.cursando} cursando
        </span>
        <span>
          <i className="d-pe" />
          {a.pendientes} pendientes
        </span>
      </div>

      <div className="ps-grid">
        <section className="ps-sec">
          <h4 className="ps-h">Títulos</h4>
          {hitos(db).map((h) => (
            <div className={`ps-mile ${h.ok ? 'ok' : ''}`} key={h.titulo}>
              <span className="m-mark">{h.ok ? '✓' : '○'}</span>
              <span className="m-name">{h.titulo}</span>
              <b>{h.ok ? '¡Conseguido!' : `faltan ${h.falta}`}</b>
            </div>
          ))}
        </section>
        <section className="ps-sec">
          <h4 className="ps-h">Avance por año</h4>
          {avancePorAnio(db).map((y) => (
            <div className="ps-year" key={y.year}>
              <span className="yl">{y.year}° año</span>
              <span className="yt">
                <i style={{ width: y.total ? `${(y.aprobadas / y.total) * 100}%` : '0%' }} />
              </span>
              <span className="yn">
                {y.aprobadas}/{y.total}
              </span>
            </div>
          ))}
        </section>
      </div>

      <div className="ps-grid">
        <section className="ps-sec">
          <h4 className="ps-h">Cursando ahora</h4>
          <ul className="ps-list cu">
            {cursando.length ? (
              cursando.map((m) => <li key={m.cod}>{nombreDe(db, m.cod)}</li>)
            ) : (
              <li className="mut">Ninguna por ahora</li>
            )}
          </ul>
        </section>
        <section className="ps-sec">
          <h4 className="ps-h">Pendientes de final</h4>
          <ul className="ps-list fi">
            {final.length ? (
              final.map((m) => <li key={m.cod}>{nombreDe(db, m.cod)}</li>)
            ) : (
              <li className="mut">Ninguna por ahora</li>
            )}
          </ul>
        </section>
      </div>

      <div className="ps-foot">Promedio sin aplazos · Generado el {fecha} · cuantomefalta.app</div>
    </div>
  )
}
