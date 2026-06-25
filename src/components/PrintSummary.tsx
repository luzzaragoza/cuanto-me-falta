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
      <div className="ps-head">
        <div className="ps-av">
          {perfil?.photo ? <img src={perfil.photo} alt="" /> : <span>{iniciales(perfil?.name) || '·'}</span>}
        </div>
        <div>
          <div className="ps-name">{nombre}</div>
          <div className="ps-sub">Ingeniería en Informática · UADE — Plan 1621</div>
        </div>
        <div className="ps-figs">
          <div className="ps-pct">
            {prom.valor ?? '—'}
            <span>promedio</span>
          </div>
          <div className="ps-pct">
            {a.pct}%<span>aprobado</span>
          </div>
        </div>
      </div>

      <div className="ps-bar">
        <i className="s-ap" style={seg(a.aprobadas)} />
        <i className="s-fi" style={seg(a.final)} />
        <i className="s-cu" style={seg(a.cursando)} />
      </div>

      <div className="ps-counts">
        <span className="ch ap">{a.aprobadas} aprobadas</span>
        <span className="ch fi">{a.final} pend. de final</span>
        <span className="ch cu">{a.cursando} cursando</span>
        <span className="ch pe">{a.pendientes} pendientes</span>
        <span className="ch pe">{a.total} en total</span>
      </div>

      <div className="ps-cols">
        <div className="ps-block">
          <h4>Títulos</h4>
          {hitos(db).map((h) => (
            <div className={`ps-mile ${h.ok ? 'ok' : ''}`} key={h.titulo}>
              <span>{h.ok ? '✓' : '·'}</span> {h.titulo}
              <b>{h.ok ? '¡Conseguido!' : `${h.falta} materias`}</b>
            </div>
          ))}
        </div>
        <div className="ps-block">
          <h4>Avance por año</h4>
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
        </div>
      </div>

      <div className="ps-now">
        <div>
          <h4>Cursando ahora</h4>
          <ul>
            {cursando.length ? (
              cursando.map((m) => <li key={m.cod}>{nombreDe(db, m.cod)}</li>)
            ) : (
              <li className="mut">—</li>
            )}
          </ul>
        </div>
        <div>
          <h4>Pendientes de final</h4>
          <ul>
            {final.length ? (
              final.map((m) => <li key={m.cod}>{nombreDe(db, m.cod)}</li>)
            ) : (
              <li className="mut">—</li>
            )}
          </ul>
        </div>
      </div>

      <div className="ps-foot">Generado el {fecha} · ¿Cuánto me falta?</div>
    </div>
  )
}
