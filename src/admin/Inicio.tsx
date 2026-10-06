// La puerta de entrada del lado institucional (diseño de Luz, 28-sep).
//
// Antes `#admin` abría directo en la lista de planes, porque cargar planes era lo único
// que se hacía acá. Con el panel de resultados son dos trabajos distintos —mirar cómo
// les va a los alumnos y mantener el catálogo—, y quien entra elige por cuál empezar.
// El superadmin ve una tercera puerta: permisos y cupos, lo único que es solo suyo.

import type { SesionAdmin } from '../lib/admin'

export function Inicio({
  sesion,
  alcance,
  nombre,
}: {
  sesion: SesionAdmin
  /** El kicker de arriba: la sigla de su universidad, o "2 instituciones". */
  alcance: string
  /** Nombre de pila de la cuenta, si Google lo dio. */
  nombre: string | null
}) {
  const saludo = sesion.esSuper && nombre ? `¡Hola, ${nombre}!` : '¡Hola! Qué bueno verte'
  return (
    <main className="in-main">
      <div className="in-alcance">{alcance}</div>
      <h1 className="in-saludo">{saludo}</h1>

      <div className="in-pregunta">¿Por dónde querés empezar?</div>

      <div className="in-puertas">
        <a className="in-puerta gold" href="#admin/resultados">
          <span className="in-deco" />
          <span className="in-icono">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M4 20V10M10 20V5M16 20v-7M22 20H2" />
            </svg>
          </span>
          <h2>Ver resultados</h2>
          <p>
            Cuántos alumnos usan la app, cuándo vuelven, qué materias los traban y qué miran en
            el árbol.
          </p>
          <span className="in-ir">
            Abrir el panel <span aria-hidden="true">→</span>
          </span>
        </a>

        <a className="in-puerta oliva" href="#admin/planes">
          <span className="in-deco" />
          <span className="in-icono">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <rect x="9" y="3" width="6" height="5" rx="1.6" />
              <rect x="3" y="16" width="6" height="5" rx="1.6" />
              <rect x="15" y="16" width="6" height="5" rx="1.6" />
              <path d="M12 8v3M6 16v-2.5h12V16" />
            </svg>
          </span>
          <h2>Editar el catálogo curricular</h2>
          <p>
            Planes de estudio, materias, correlativas y títulos. Los alumnos ven solo lo
            publicado.
          </p>
          <span className="in-ir">
            Ir a los planes <span aria-hidden="true">→</span>
          </span>
        </a>

        {sesion.puedeGestionarPermisos && (
          <a className="in-puerta neutro" href="#admin/permisos">
            <span className="in-deco" />
            <span className="in-icono">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <circle cx="8" cy="15" r="4.5" />
                <path d="M11.2 11.8 20 3M16.5 6.5l2.5 2.5M14 9l2 2" />
              </svg>
            </span>
            <h2>Permisos y cupos</h2>
            <p>
              Quién administra cada institución, cuántos planes puede cargar y el alta de
              instituciones nuevas.
            </p>
            <span className="in-ir">
              Gestionar permisos <span aria-hidden="true">→</span>
            </span>
          </a>
        )}
      </div>
    </main>
  )
}
