import type { DB } from '../types'
import { avanceDe } from '../domain/Avance'
import { plan } from '../domain/Plan'

interface Props {
  db: DB
  onOpenTree: () => void
  onOpenNotas: () => void
}

const TreeIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="5" rx="1.2" />
    <rect x="3" y="16" width="6" height="5" rx="1.2" />
    <rect x="15" y="16" width="6" height="5" rx="1.2" />
    <path d="M12 8v3M6 16v-2.5h12V16" />
  </svg>
)

const NotesIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </svg>
)

const Flecha = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

// Las notas que puede tener una materia aprobada, para el histograma de Notas.
const NOTAS = [4, 5, 6, 7, 8, 9, 10]

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

export function Dashboard({ db, onOpenTree, onOpenNotas }: Props) {
  const av = avanceDe(db)
  const a = av.conteos
  const mats = plan.materias()
  const disponibles = mats.filter((m) => av.disponible(m.cod)).length
  const faltan = a.total - a.aprobadas

  // Histograma de Notas: cuántas aprobadas hay con cada nota.
  const notas = mats
    .filter((m) => av.estado(m.cod) === 'aprobada')
    .map((m) => db.nota(m.cod))
    .filter((v): v is number => typeof v === 'number')
  const maxBarra = Math.max(1, ...NOTAS.map((n) => notas.filter((v) => v === n).length))
  const promedio = av.promedio.valor

  /** La clase de un casillero del mapa. "Disponible" no es un estado: es una
   *  pendiente que ya se puede cursar, y es la única que va resaltada. */
  const celda = (cod: string) => {
    const e = av.estado(cod)
    return e === 'pendiente' && av.disponible(cod) ? 'avail' : e
  }

  return (
    <section className="dash">
      <div className="hero">
        <div className="hero-top">
          <div className="hero-tx">
            {/* La respuesta a la pregunta que le da nombre a la app, resaltada. */}
            <h2 className="hero-tit">
              {faltan === 0 ? (
                <>
                  Ya <mark>no te falta nada</mark>
                </>
              ) : (
                <>
                  {plural(faltan, 'Te falta', 'Te faltan')}{' '}
                  <mark>
                    {faltan} {plural(faltan, 'materia', 'materias')}
                  </mark>
                </>
              )}
            </h2>
            <p className="hero-sub">
              {disponibles === 1
                ? '1 materia disponible para cursar ahora'
                : `${disponibles} materias disponibles para cursar ahora`}
            </p>
          </div>
          <div className="bignum">
            <span className="num">
              {a.pct}
              <small>%</small>
            </span>
            <span className="cap">aprobado</span>
          </div>
        </div>

        {/* El mapa de la carrera: un casillero por materia, un bloque por año y una
            fila por cuatrimestre. Es un dibujo, no un control — los conteos de abajo
            y el plan dicen lo mismo en texto. */}
        <div
          className="mapa"
          role="img"
          aria-label={`Mapa de la carrera: ${a.aprobadas} aprobadas, ${a.final} pendientes de final, ${a.cursando} cursando y ${a.pendientes} pendientes, de ${a.total} materias.`}
        >
          {plan.anios.map((anio) => (
            <div className="mapa-anio" key={anio.year}>
              <span className="mapa-lbl">{anio.year}° año</span>
              <div className="mapa-filas">
                {anio.cuatris.map((q) => (
                  <div className="mapa-fila" key={q.n}>
                    {q.mats.map((m) => (
                      <i key={m.cod} className={celda(m.cod)} title={av.nombreDe(m.cod)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="counts">
          <span className="c">
            <i className="d-ap" />
            <b>{a.aprobadas}</b> aprobadas
          </span>
          <span className="c">
            {/* Mitad llena: la cursada está, falta el final. La forma dice lo mismo
                que el color, que es lo que sostiene la distinción sin depender del matiz. */}
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
          {disponibles > 0 && (
            <span className="c">
              <i className="d-av" />
              <b>{disponibles}</b> {plural(disponibles, 'disponible', 'disponibles')}
            </span>
          )}
        </div>
      </div>

      <div className="nav-tiles">
        <button className="nav-tile" type="button" onClick={onOpenTree}>
          <span className="nt-ico">
            <TreeIcon />
          </span>
          <span className="nt-tx">
            <span className="nt-t">Árbol de correlativas</span>
            <span className="nt-d">Qué necesita y qué habilita cada materia</span>
          </span>
          <span className="nt-fl" aria-hidden="true">
            <Flecha />
          </span>
        </button>

        <button className="nav-tile" type="button" onClick={onOpenNotas}>
          <span className="nt-ico">
            <NotesIcon />
          </span>
          <span className="nt-tx">
            <span className="nt-t">Notas</span>
            <span className="nt-d">
              {promedio == null
                ? 'Cargá tus notas y mirá tu promedio'
                : `Promedio ${promedio.toFixed(2).replace('.', ',')} · ${notas.length} con nota`}
            </span>
          </span>
          {/* Cómo se reparten las notas, del 4 al 10. Solo si hay alguna cargada:
              siete barras vacías no dicen nada. */}
          {notas.length > 0 && (
            <span className="nt-barras" aria-hidden="true">
              {NOTAS.map((n) => {
                const c = notas.filter((v) => v === n).length
                return (
                  <i
                    key={n}
                    className={c === 0 ? 'b0' : undefined}
                    style={{ height: c ? `${22 + (c / maxBarra) * 78}%` : '8%' }}
                  />
                )
              })}
            </span>
          )}
          <span className="nt-fl" aria-hidden="true">
            <Flecha />
          </span>
        </button>
      </div>
    </section>
  )
}
