import type { DB } from '../types'
import { avanceDe } from '../domain/Avance'
import { plan } from '../domain/Plan'

interface Props {
  db: DB
  onOpenTree: () => void
  onOpenNotas: () => void
}

const TreeIcon = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="5" rx="1.6" />
    <rect x="3" y="16" width="6" height="5" rx="1.6" />
    <rect x="15" y="16" width="6" height="5" rx="1.6" />
    <path d="M12 8v3M6 16v-2.5h12V16" />
  </svg>
)

const NotesIcon = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </svg>
)

// El anillo. El radio y el grosor son los del diseño; `CIRC` es el largo del trazo
// completo, que es la unidad en la que se miden los segmentos (stroke-dasharray).
const R = 84
const CIRC = 2 * Math.PI * R

// Las notas que puede tener una materia aprobada, para el histograma de la tarjeta.
const NOTAS = [4, 5, 6, 7, 8, 9, 10]

export function Dashboard({ db, onOpenTree, onOpenNotas }: Props) {
  const av = avanceDe(db)
  const a = av.conteos
  const mats = plan.materias()
  const disponibles = mats.filter((m) => av.disponible(m.cod)).length
  const faltan = a.total - a.aprobadas

  // Un segmento por estado, en orden. Se le come 3px al final de cada uno para que
  // queden separados: sin ese respiro, dos segmentos contiguos se leen como uno solo.
  const segmentos: { color: string; dash: string; off: number }[] = []
  let corrido = 0
  for (const s of [
    { n: a.aprobadas, color: 'var(--ap)' },
    { n: a.final, color: 'var(--fi)' },
    { n: a.cursando, color: 'var(--cu)' },
  ]) {
    if (!s.n || !a.total) continue
    const largo = (s.n / a.total) * CIRC
    const trazo = Math.max(largo - 3, 1)
    segmentos.push({ color: s.color, dash: `${trazo} ${CIRC - trazo}`, off: -corrido })
    corrido += largo
  }

  // Histograma de la tarjeta de Notas: cuántas aprobadas hay con cada nota.
  const notas = mats
    .filter((m) => av.estado(m.cod) === 'aprobada')
    .map((m) => db.nota(m.cod))
    .filter((v): v is number => typeof v === 'number')
  const maxBarra = Math.max(1, ...NOTAS.map((n) => notas.filter((v) => v === n).length))
  const promedio = av.promedio.valor

  return (
    <section className="dash">
      <div className="hero">
        <div className="ring">
          <svg width="200" height="200" aria-hidden="true">
            <circle cx="100" cy="100" r={R} className="ring-riel" />
            {segmentos.map((s, i) => (
              <circle
                key={i}
                cx="100"
                cy="100"
                r={R}
                stroke={s.color}
                strokeDasharray={s.dash}
                strokeDashoffset={s.off}
              />
            ))}
          </svg>
          <div className="bignum">
            <span className="num">
              {a.pct}
              <small>%</small>
            </span>
            <span className="cap">aprobado</span>
          </div>
        </div>

        <div className="hero-tx">
          <h2 className="hero-tit">
            {faltan === 0 ? 'Ya no te falta nada' : `Te faltan ${faltan} materias`}
          </h2>
          <p className="hero-sub">
            {disponibles === 1
              ? '1 materia disponible para cursar ahora'
              : `${disponibles} materias disponibles para cursar ahora`}
          </p>

          <div className="counts">
            <span className="c">
              <i className="d-ap" />
              <b>{a.aprobadas}</b> aprobadas
            </span>
            <span className="c">
              {/* Mitad llena: la cursada está, falta el final. El glifo dice lo mismo que
                  el color, que es lo que sostiene la distinción sin depender del matiz. */}
              <i className="d-fi" />
              <b>{a.final}</b> pend. de final
            </span>
            <span className="c">
              <i className="d-cu" />
              <b>{a.cursando}</b> cursando
            </span>
            <span className="c">
              <i className="d-pe" />
              <b>{a.pendientes}</b> pendientes
            </span>
          </div>
        </div>
      </div>

      <div className="nav-tiles">
        <button className="nav-tile" type="button" onClick={onOpenTree}>
          <span className="nt-head">
            <TreeIcon />
            <span className="nt-t">Árbol de correlativas</span>
            <span className="nt-r">ver cadenas →</span>
          </span>
          {/* Miniatura fija: no dibuja el plan real, muestra el GESTO — de qué depende
              una materia y qué habilita. Es la promesa de la pantalla que abre. */}
          <svg className="nt-mini" viewBox="0 0 260 84" width="100%" height="84" aria-hidden="true">
            <path d="M62 26 C86 26 84 42 108 42" fill="none" stroke="var(--lk)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M62 62 C86 62 84 46 108 46" fill="none" stroke="var(--line-fuerte)" strokeWidth="2" strokeLinecap="round" />
            <path d="M170 42 C192 42 190 24 212 24" fill="none" stroke="var(--hb)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M170 46 C192 46 190 64 212 64" fill="none" stroke="var(--hb)" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="6" y="14" width="56" height="24" rx="9" fill="var(--lk-bg)" stroke="var(--lk)" strokeWidth="1.5" />
            <rect x="6" y="50" width="56" height="24" rx="9" fill="var(--sunk)" stroke="var(--line-marca)" strokeWidth="1" />
            <rect x="108" y="30" width="62" height="26" rx="10" fill="var(--gold)" />
            <rect x="212" y="12" width="42" height="24" rx="9" fill="var(--hb-bg)" stroke="var(--hb)" strokeWidth="1.5" />
            <rect x="212" y="52" width="42" height="24" rx="9" fill="var(--hb-bg)" stroke="var(--hb)" strokeWidth="1.5" />
          </svg>
        </button>

        <button className="nav-tile" type="button" onClick={onOpenNotas}>
          <span className="nt-head">
            <NotesIcon />
            <span className="nt-t">Notas</span>
            <span className="nt-r">promedio y notas →</span>
          </span>
          <span className="nt-notas">
            <span className="nt-prom">
              <span className="np-n">
                {promedio == null ? '—' : promedio.toFixed(2).replace('.', ',')}
              </span>
              <span className="np-c">promedio</span>
            </span>
            <span className="nt-barras">
              {NOTAS.map((n) => {
                const c = notas.filter((v) => v === n).length
                return (
                  <i
                    key={n}
                    className={c === 0 ? 'b0' : n >= 8 ? 'b-alta' : n >= 6 ? 'b-media' : 'b-baja'}
                    style={{ height: c ? `${16 + (c / maxBarra) * 84}%` : '10%' }}
                  />
                )
              })}
            </span>
          </span>
        </button>
      </div>
    </section>
  )
}
