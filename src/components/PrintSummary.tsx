import { useDB } from '../state/store'
import { avanceDe } from '../domain/Avance'
import type { Avance } from '../domain/Avance'
import { plan } from '../domain/Plan'
import { nombreUniversidad } from '../data/planes'
import type { MateriaUbicada } from '../domain/Plan'

/**
 * La hoja del export: UNA carilla A4 (794×1123 a 96dpi), visible solo al imprimir.
 *
 * No se rasteriza ni se arma con una librería de PDF: es HTML con `@media print`, así que
 * el texto sale seleccionable y los códigos de materia no quedan sucios. `window.print()`
 * la dispara desde el menú de Opciones.
 *
 * Todo lo que se dibuja acá tiene que ENTRAR en una carilla, con cualquier avance y con
 * cualquiera de los planes. Por eso las listas tienen tope y varios bloques desaparecen
 * cuando no tienen nada que decir, en vez de quedar como cajas vacías.
 *
 * El orden es el del rediseño de Luz: el avance y su barra viven en UNA tarjeta ancha
 * arriba, y debajo el promedio junto a los títulos del plan. El bloque "te conviene
 * anotarte a" se sacó a pedido de ella.
 *
 * Ojo con la REPETICIÓN, que fue el último feedback: "N de M aprobadas", "te faltan M−N"
 * y "te faltan X para el próximo título" son tres vistas de la misma resta. Acá el total
 * aparece UNA vez (el % con su denominador), el desglose lo da la leyenda, y los "faltan"
 * viven pegados al título al que pertenecen.
 */

/** Cuántas materias entran en cada lista antes de resumir el resto en "y N más". */
const TOPE_LISTA = 8

export function PrintSummary() {
  const db = useDB()
  const av = avanceDe(db)
  const a = av.conteos
  const prom = av.promedio
  const perfil = db.profile
  const nombre = perfil?.name?.trim() || 'Mi plan de carrera'
  const universidad = nombreUniversidad(plan.def.universidad)
  const fecha = new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const cursando = av.materiasEn('cursando')
  const final = av.materiasEn('final')

  return (
    <div id="print-summary">
      <header className="ps-head">
        <div className="ps-id">
          {/* Las iniciales se pintan en el círculo y la foto va ENCIMA. Si la foto no
              carga —es una URL remota de Google y esto es una hoja que se imprime, así
              que va a pasar— hay que ESCONDER la imagen: con `alt=""` sola, Chrome igual
              dibuja su ícono de imagen rota sobre las iniciales (verificado). */}
          <span className="ps-av">
            {perfil?.iniciales || '·'}
            {perfil?.photo ? (
              <img
                src={perfil.photo}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : null}
          </span>
          <div>
            <div className="ps-name">{nombre}</div>
            <div className="ps-sub">
              {plan.carrera} · {universidad}
            </div>
          </div>
        </div>
        <div className="ps-marca">
          <span className="ps-logo">¿Cuánto me falta?</span>
          <span className="ps-plan">Plan {plan.def.codigo}</span>
        </div>
      </header>

      <section className="ps-hero">
        <div className="ps-hero-l">
          <span className="ps-kicker">Avance de carrera</span>
          <span className="ps-stat-n verde">
            {a.pct}
            <i>%</i>
          </span>
          <span className="ps-stat-s">sobre {a.total} materias</span>
        </div>
        <div className="ps-hero-r">
          <Barra total={a.total} aprobadas={a.aprobadas} final={a.final} cursando={a.cursando} />
          <div className="ps-legend">
            <span>
              <i className="g-ap" />
              Aprobadas <b>{a.aprobadas}</b>
            </span>
            <span>
              <i className="g-cu" />
              Cursando <b>{a.cursando}</b>
            </span>
            <span>
              <i className="g-fi" />
              Pendientes de final <b>{a.final}</b>
            </span>
            <span>
              <i className="g-pe" />
              Pendientes <b>{a.pendientes}</b>
            </span>
          </div>
        </div>
      </section>

      <div className="ps-stats">
        <div className="ps-stat">
          <span className="ps-stat-l">Promedio</span>
          <span className={`ps-stat-n${prom.valor == null ? ' vacio' : ''}`}>
            {prom.valor != null ? prom.valor.toFixed(2).replace('.', ',') : 'sin datos'}
          </span>
          <span className="ps-stat-s">
            {prom.valor != null
              ? `sin aplazos · ${prom.conNota} con nota`
              : 'cargá notas para verlo'}
          </span>
        </div>

        {/* Los títulos del plan, con lo que falta para CADA uno.
            Antes había además un cuadro "te faltan 30/52 para el título de grado", y ese
            30 es exactamente el `falta` del último hito: era el número de un título,
            suelto y lejos de su título. Juntarlos saca la repetición y de paso muestra
            los hitos intermedios, que antes no se veían (solo salía el próximo). */}
        <div className="ps-titulos">
          <span className="ps-stat-l">Títulos del plan</span>
          <ul>
            {av.hitos.map((h) => (
              <li key={h.titulo} className={h.ok ? 'ok' : ''}>
                <span className="ps-hito-n">{h.titulo}</span>
                <span className="ps-hito-f">
                  {h.ok ? '✓ lo tenés' : <>te faltan <b>{h.falta}</b></>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {cursando.length + final.length > 0 && (
        <div className="ps-listas">
          <Lista titulo="Cursando ahora" glifo="g-cu" mats={cursando} av={av} />
          <Lista titulo="Pendientes de final" glifo="g-fi" mats={final} av={av} />
        </div>
      )}

      <section className="ps-anios">
        <div className="ps-kicker">Avance por año</div>
        <div className="ps-anios-g">
          {av.porAnio.map((y) => (
            <div className="ps-anio" key={y.year}>
              <span className="ps-anio-l">{y.year}° año</span>
              <Barra
                total={y.total}
                aprobadas={y.aprobadas}
                final={y.final}
                cursando={y.cursando}
                fina
              />
              <span className="ps-anio-n">
                {y.aprobadas}/{y.total}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="ps-foot">
        <div className="ps-legal">
          Promedio sin aplazos. Documento generado por vos con datos de carga manual:{' '}
          <strong>no es un certificado analítico</strong> ni tiene validez oficial ante{' '}
          {universidad}.
        </div>
        <div className="ps-sello">
          {fecha}
          <br />
          cuantomefalta.app
        </div>
      </footer>
    </div>
  )
}

/**
 * La barra de estados, en dos tamaños (la de la tarjeta grande y la de cada año).
 *
 * "Pendientes de final" va RAYADO y no como un cuarto color: en esta paleta `--cu` y
 * `--fi` son la misma familia, así que lo que los distingue tiene que ser un canal NO
 * cromático (la trama acá, el glifo en la leyenda). Aplanarlo a un color plano rompe la
 * regla de accesibilidad que cumple el resto de la app.
 */
function Barra({
  total,
  aprobadas,
  final,
  cursando,
  fina = false,
}: {
  total: number
  aprobadas: number
  final: number
  cursando: number
  fina?: boolean
}) {
  const ancho = (n: number) => ({ width: total ? `${(n / total) * 100}%` : '0%' })
  return (
    <div className={`ps-bar${fina ? ' fina' : ''}`}>
      <i className="s-ap" style={ancho(aprobadas)} />
      <i className="s-fi" style={ancho(final)} />
      <i className="s-cu" style={ancho(cursando)} />
    </div>
  )
}

/** Una de las dos listas del medio, con tope para que la hoja no se vaya a una 2ª carilla. */
function Lista({
  titulo,
  glifo,
  mats,
  av,
}: {
  titulo: string
  glifo: string
  mats: MateriaUbicada[]
  av: Avance
}) {
  const visibles = mats.slice(0, TOPE_LISTA)
  const resto = mats.length - visibles.length
  return (
    <section className="ps-lista">
      <div className="ps-lista-h">
        <i className={glifo} />
        {titulo}
        <b>{mats.length}</b>
      </div>
      <ul>
        {visibles.map((m) => (
          <li key={m.cod}>
            <span className="ps-mat">{av.nombreDe(m.cod)}</span>
            <span className="ps-cod">{m.cod}</span>
          </li>
        ))}
        {resto > 0 && <li className="ps-mas">y {resto} más</li>}
        {mats.length === 0 && <li className="ps-mas">Ninguna por ahora</li>}
      </ul>
    </section>
  )
}
