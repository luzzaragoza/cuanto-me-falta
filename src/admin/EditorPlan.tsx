// Editor de un plan de estudios. Tres pestañas (estructura · correlativas · títulos) y
// un panel de publicación.
//
// Decisiones de Luz que gobiernan esta pantalla:
//  · Materias INLINE en la grilla: clic y escribís, Tab al siguiente. Es lo único que
//    cumple el Gate C (una carrera de ~40 materias en menos de 2 horas).
//  · Correlativas TILDANDO de una lista que solo ofrece cuatrimestres anteriores, así no
//    se puede cargar una flecha imposible, con la cadena redibujándose al lado.
//  · AUTOGUARDADO en el borrador: como el borrador es invisible para los alumnos hasta
//    que se publica, guardar seguido no tiene riesgo — y no se puede perder una hora de
//    carga por cerrar la pestaña. Se guarda al salir del campo (Tab ya commitea) y
//    además con un retardo corto mientras escribís.

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TituloPlan } from '../data/model'
import { Plan } from '../domain/Plan'
import type { Borrador, MateriaEdit } from '../lib/editorPlan'
import { useExitAnimation } from '../hooks/useExitAnimation'
import { Validacion } from '../lib/validarPlan'
import { Diff, type Cambio, type Guardado as QueGuardar } from '../lib/cambios'
import { Pasos } from '../lib/pasos'
import { Historial } from '../lib/historial'
import { toast } from '../lib/toast'
import { Tour } from '../components/Tour'
import { useConfirmar } from '../components/Confirmar'
import { PASOS_EDITOR, TOUR_EDITOR_KEY, marcarTourVisto, tourVisto } from './tourAdmin'
import type { PlanDef } from '../data/model'
import { repo } from '../state/admin'

// El árbol vive en su propio chunk (pesa: trae el motor de layout). Solo lo baja quien
// entra a cargar correlativas.
const TreeView = lazy(() =>
  import('../components/Tree/TreeView').then((m) => ({ default: m.TreeView })),
)

type Pestania = 'estructura' | 'correlativas' | 'titulos'
type Direccion = 'anterior' | 'posterior'
type Guardado = 'limpio' | 'guardando' | 'guardado' | 'error'

const DEMORA_GUARDADO = 1200

/** Un símbolo por tipo de cambio: se escanea la lista sin leerla entera. */
const SIGNO: Record<Cambio['tipo'], string> = {
  'sin-publicar': '!',
  cabecera: '✎',
  'materia-nueva': '+',
  'materia-borrada': '−',
  'materia-editada': '✎',
  'correlativa-nueva': '+',
  'correlativa-borrada': '−',
  titulos: '✎',
}

export function EditorPlan({
  planId,
  puedeEditar,
  onVolver,
}: {
  planId: string
  puedeEditar: boolean
  onVolver: () => void
}) {
  const [b, setB] = useState<Borrador | null>(null)
  const [pestania, setPestania] = useState<Pestania>('estructura')
  const [guardado, setGuardado] = useState<Guardado>('limpio')
  const [error, setError] = useState<string | null>(null)
  const [objetivo, setObjetivo] = useState<string | null>(null)
  const [direccion, setDireccion] = useState<Direccion>('anterior')
  const [arbol, setArbol] = useState(false)
  /** Filtro de la pestaña de correlativas: "¿qué me falta?" preguntado una vez. */
  const [soloSinPrevias, setSoloSinPrevias] = useState(false)
  /** Lo tipeado en el buscador de la materia abierta. Se limpia al abrir otra. */
  const [busca, setBusca] = useState('')
  /** El panel de revisar y publicar, abierto o cerrado (drawer, como el de Notas). */
  const [panel, setPanel] = useState(false)
  /** La foto que ven los alumnos. `null` = nunca se publicó. */
  const [publicado, setPublicado] = useState<PlanDef | null>(null)
  const [publicando, setPublicando] = useState(false)
  const [nota, setNota] = useState('')
  const [versiones, setVersiones] = useState<
    Array<{ version: number; publicado_at: string; nota: string | null }>
  >([])
  const timers = useRef(new Map<number, number>())
  /** Pila de acciones deshacibles de ESTA sesión (Ctrl+Z). */
  const [historial, setHistorial] = useState(new Historial())
  const [tourHecho, setTourHecho] = useState(() => tourVisto(TOUR_EDITOR_KEY))
  const { pedir, dialogo } = useConfirmar()
  /** El borrador al entrar a un campo de texto: se apila recién al confirmar. */
  const alEnfocar = useRef<Borrador | null>(null)
  /**
   * El listener de teclado se registra UNA vez (antes de los early returns, como manda
   * React) pero tiene que llamar a la versión fresca de `deshacerUltimo`, que se define
   * más abajo con el estado actual. La ref es el puente.
   */
  const deshacerUltimoRef = useRef<() => void>(() => {})

  useEffect(() => {
    let vivo = true
    repo.cargarBorrador(planId)
      .then((bo) => {
        if (!vivo) return
        setB(bo)
        return Promise.all([repo.cargarVersiones(planId), repo.cargarPublicado(planId)]).then(
          ([vs, pub]) => {
            if (!vivo) return
            setVersiones(vs)
            setPublicado(pub)
          },
        )
      })
      .catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      vivo = false
    }
  }, [planId])

  /** Corre una escritura mostrando el estado, sin tirar nunca. */
  const correr = useCallback(async (fn: () => Promise<void>) => {
    setGuardado('guardando')
    try {
      await fn()
      setGuardado('guardado')
      setError(null)
    } catch (e) {
      setGuardado('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  /** Guarda una materia si ya tiene lo mínimo; si no, no molesta. */
  const guardarFila = useCallback(
    (m: MateriaEdit) => {
      if (!m.guardable) return
      void correr(async () => {
        await repo.guardarMateria(planId, m)
        // tras el primer guardado deja de ser nueva y su código pasa a ser el de la base
        setB((prev) =>
          prev
            ? prev.conMaterias(
                prev.materias.map((x) =>
                  x.orden === m.orden ? x.con({ nueva: false, codOriginal: m.cod.trim() }) : x,
                ),
              )
            : prev,
        )
      })
    },
    [correr, planId],
  )

  /** Programa el guardado de una fila (mientras se escribe). */
  const guardarConDemora = useCallback(
    (m: MateriaEdit) => {
      const previo = timers.current.get(m.orden)
      if (previo) clearTimeout(previo)
      timers.current.set(
        m.orden,
        window.setTimeout(() => {
          timers.current.delete(m.orden)
          guardarFila(m)
        }, DEMORA_GUARDADO),
      )
    },
    [guardarFila],
  )

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

  // Ctrl+Z / ⌘+Z. Se ignora si el foco está en un campo de texto: ahí manda el deshacer
  // del navegador, que trabaja por carácter. Pisarlo daría un atajo que a veces borra una
  // letra y a veces una materia entera.
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent): void => {
      if (!(e.key === 'z' || e.key === 'Z') || !(e.ctrlKey || e.metaKey) || e.shiftKey) return
      const foco = document.activeElement
      const enTexto =
        foco instanceof HTMLInputElement &&
        (foco.type === 'text' || foco.type === 'number' || foco.type === '')
      if (enTexto) return
      e.preventDefault()
      deshacerUltimoRef.current()
    }
    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
  }, [])

  // Qué cambió contra lo que ven los alumnos. Se recalcula con cada edición: es una
  // comparación, no un registro de acciones, así que no puede quedar desincronizada.
  const diff = useMemo(() => (b ? new Diff(publicado, b) : null), [publicado, b])
  const cambios = diff?.cambios ?? []
  const reversibles = diff?.reversibles ?? []
  /**
   * Qué le pasó a cada materia, para poder marcarla EN LA GRILLA.
   *
   * El panel dice qué cambió; la grilla muestra dónde. Leer "movida de 2° a 3°" sin
   * poder ver la fila era justo lo abstracto del panel anterior.
   */
  const cambioPorCod = useMemo(() => {
    const m = new Map<string, Cambio['tipo']>()
    for (const c of diff?.cambios ?? []) for (const cod of c.cods) m.set(cod, c.tipo)
    return m
  }, [diff])

  // ── derivados del árbol-editor ──
  // Van ACÁ, antes de los early returns: los hooks no pueden ser condicionales.
  // El plan se rearma en cada cambio a propósito: así el esqueleto del árbol se
  // actualiza mientras conectás.
  const planDelBorrador = useMemo(() => (b ? new Plan(b.aPlan()) : null), [b])
  const elegiblesAhora = useMemo(() => {
    if (!b) return new Set<string>()
    if (!objetivo) return new Set(b.materias.filter((m) => m.cod.trim()).map((m) => m.cod))
    const lista =
      direccion === 'anterior'
        ? b.elegiblesComoPrevia(objetivo)
        : b.elegiblesComoPosterior(objetivo)
    return new Set(lista.map((m) => m.cod))
  }, [b, objetivo, direccion])
  const conectadasAhora = useMemo(() => {
    if (!b || !objetivo) return new Set<string>()
    return new Set(direccion === 'anterior' ? b.previasDe(objetivo) : b.dependenDe(objetivo))
  }, [b, objetivo, direccion])

  if (error && !b) {
    return (
      <div className="adm-card adm-vacio">
        <h2>No pude abrir el plan</h2>
        <p>{error}</p>
        <button className="lnk" onClick={onVolver}>
          ← Volver a mis planes
        </button>
      </div>
    )
  }
  if (!b) return <div className="adm-card adm-vacio">Abriendo el plan…</div>

  const plan = b.aPlan()
  const revision = new Validacion(plan)
  const errores = revision.errores
  const avisos = revision.avisos
  const cuenta = b.resumen
  const anios = b.anios
  // Dónde estás y qué falta. `publicado && !hay cambios` = los alumnos ya ven esto.
  const pasos = new Pasos(b)
  const materias = b.ordenadas

  /*
   * Cuántas materias PUEDEN llevar previas, y cuántas ya tienen.
   *
   * El denominador no es "todas": las del primer cuatrimestre no tienen nada antes y las
   * optativas quedan fuera del grafo (RN-05), así que contarlas haría que el número nunca
   * llegue al total y pareciera trabajo pendiente para siempre.
   */
  const conectables = materias.filter(
    (m) => m.cod.trim() && !m.opt && b.elegiblesComoPrevia(m.cod).length > 0,
  )
  const conPrevias = conectables.filter((m) => b.previasDe(m.cod).length > 0).length

  /** El borrador es idéntico a la foto que ven los alumnos: publicar no haría nada. */
  const nadaQuePublicar = reversibles.length === 0 && cambios.length === 0

  /**
   * Publicar, con su confirmación antes y su aviso después.
   *
   * Vive acá y no dentro del JSX porque quien lo dispara es el PIE del drawer, que se
   * arma como prop unas líneas más arriba de donde se usa.
   */
  const publicarAhora = (): void => {
    pedir({
      titulo: publicado ? '¿Publicar los cambios?' : '¿Publicar el plan?',
      texto: publicado
        ? 'Los alumnos van a ver esta versión. A quien tenga la app abierta le aparece un aviso para actualizar.'
        : 'A partir de ahora los alumnos van a poder elegir esta carrera.',
      confirmar: 'Publicar',
      onSi: () => {
        setPublicando(true)
        void (async () => {
          try {
            const v = await repo.publicar(planId, nota.trim() || null)
            setNota('')
            setError(null)
            // Se vuelve a la lista: es ahí donde se verifica que quedó publicado, con su
            // versión y sin "cambios sin publicar". Publicar es el momento importante de
            // toda la pantalla, así que se avisa con un diálogo y no con un toast que se
            // va solo.
            pedir({
              titulo: '¡Publicado!',
              texto: `Quedó como la versión ${v}. Los alumnos ya la ven, y a quien tenga la app abierta le va a aparecer un aviso para actualizar.`,
              confirmar: 'Volver a mis planes',
              aviso: true,
              onSi: onVolver,
            })
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
            setPublicando(false)
          }
        })()
      },
    })
  }

  /**
   * El nombre de una materia por su código, para los mensajes.
   *
   * Los avisos hablaban en códigos (`3.4.071 ← 3.4.069`) y eso solo lo entiende quien
   * ya se sabe el plan de memoria. Se muestra el nombre, con el código al lado para
   * poder ubicarlo en la grilla.
   */
  const nombreDe = (cod: string): string => {
    const m = b.materias.find((x) => x.cod === cod)
    return m?.nom ? `${m.nom} (${cod})` : cod
  }

  const cambiar = (nuevo: Borrador): void => setB(nuevo)

  /**
   * Aplica un cambio Y lo deja deshacible. Es la puerta por la que pasan las acciones
   * discretas (agregar, borrar, mover, tildar, conectar): guarda el borrador ANTERIOR y
   * qué escritura hace falta para que la base vuelva ahí.
   */
  const aplicar = (nuevo: Borrador, etiqueta: string, guardar: QueGuardar | null): void => {
    setHistorial((h) => h.con({ etiqueta, antes: b, guardar }))
    setB(nuevo)
  }

  /**
   * Apila una edición de texto al salir del campo, y solo si de verdad cambió algo.
   * Escribir y volver a dejarlo igual no ensucia el historial.
   */
  const anotarEdicion = (etiqueta: string, guardar: QueGuardar | null): void => {
    const antes = alEnfocar.current
    alEnfocar.current = null
    if (!antes || antes === b) return
    setHistorial((h) => h.con({ etiqueta, antes, guardar }))
  }

  /** Deshace la última acción de esta sesión y persiste la vuelta atrás. */
  const deshacerUltimo = (): void => {
    const r = historial.deshacer()
    if (!r || !puedeEditar) return
    setHistorial(r.historial)
    setB(r.accion.antes)
    void correr(() => persistir(r.accion.antes, r.accion.guardar))
    toast.show(`Deshecho: ${r.accion.etiqueta}`, 'info')
  }
  deshacerUltimoRef.current = deshacerUltimo

  /** Escribe lo que corresponda después de deshacer un cambio. */
  const persistir = async (bo: Borrador, g: QueGuardar | null): Promise<void> => {
    if (!g) return
    if (g.que === 'materia-borrar') return repo.borrarMateria(planId, g.cod)
    if (g.que === 'previas') return repo.guardarPrevias(planId, g.cod, bo.previasDe(g.cod))
    if (g.que === 'titulos') return repo.guardarTitulos(planId, bo.titulos)
    if (g.que === 'cabecera') {
      return repo.guardarCabecera(planId, { codigo: bo.codigo, anio: bo.anio, carrera: bo.carrera })
    }
    const m = bo.materias.find((x) => x.cod === g.cod)
    if (m) return repo.guardarMateria(planId, m)
  }

  const deshacer = (c: Cambio): void => {
    if (!publicado) return
    const { borrador: r, guardar } = new Diff(publicado, b).deshacer(c)
    cambiar(r)
    void correr(() => persistir(r, guardar))
  }

  const descartarTodo = (): void => {
    if (!publicado) return
    pedir({
      titulo: `¿Descartar ${reversibles.length} ${reversibles.length === 1 ? 'cambio' : 'cambios'}?`,
      texto: 'El plan vuelve exactamente a la versión que ven los alumnos hoy.',
      confirmar: 'Descartar',
      peligro: true,
      onSi: descartarConfirmado,
    })
  }

  const descartarConfirmado = (): void => {
    if (!publicado) return
    void correr(async () => {
      let actual = b
      for (const c of reversibles) {
        const { borrador: r, guardar } = new Diff(publicado, actual).deshacer(c)
        actual = r
        await persistir(actual, guardar)
      }
      setB(actual)
    })
  }

  /*
   * Los años que se pueden ELEGIR, que no son los que hoy tienen materias.
   *
   * Antes se ofrecían solo los años ya existentes, y eso obligaba a cargar en orden: para
   * poner una materia en 4° había que haber creado el 4° año primero. Pedido de Luz
   * (12-ago): "a veces es más fácil entrar, escribir todas las materias y luego colocarlas
   * en los años". El plan con un año vacío en el medio no es un error, es un plan a medio
   * cargar — `validarPlan` lo levanta como AVISO ("el plan salta el 3° año") y aparece en
   * revisar y publicar, que es donde corresponde enterarse.
   *
   * Uno más que el último que existe, con piso en 6: alcanza para cualquier carrera de
   * grado y siempre deja lugar para empezar el año siguiente.
   */
  const topeAnio = Math.max(6, Math.max(0, ...anios) + 1)
  const opcionesCuatri = Array.from({ length: topeAnio }, (_, i) => i + 1).flatMap((a) =>
    [1, 2].map((c) => ({ valor: `${a}-${c}`, texto: `${a}° · ${c}°C` })),
  )

  return (
    <div className="ed">
      {/* Una sola vez, y solo con permiso de editar: a quien entra a mirar no le sirve
          un tutorial de cómo cargar. */}
      {!tourHecho && puedeEditar && (
        <Tour
          pasos={PASOS_EDITOR}
          onClose={() => {
            marcarTourVisto(TOUR_EDITOR_KEY)
            setTourHecho(true)
          }}
        />
      )}

      {/* ── barra del editor ── */}
      <div className="ed-bar">
        <button className="lnk" onClick={onVolver}>
          ← Mis planes
        </button>
        <div className="ed-quees">
          <strong>{b.carrera}</strong>
          <span className="adm-meta">
            plan {b.codigo} · {b.anio} · {cuenta.materias} materias · {cuenta.correlativas}{' '}
            correlativas
          </span>
        </div>
        {/* Un atajo que nadie ve no existe: el botón lo hace descubrible y de paso dice
            QUÉ se va a deshacer, así no hay que adivinar. */}
        {puedeEditar && (
          <button
            className="ed-deshacer"
            onClick={deshacerUltimo}
            disabled={!historial.puedeDeshacer}
            title={
              historial.ultima
                ? `Deshacer: ${historial.ultima.etiqueta} (Ctrl+Z)`
                : 'No hay nada que deshacer'
            }
          >
            ↶ Deshacer
          </button>
        )}
        <div className="ed-estado">
          {guardado === 'guardando' && <span className="ed-sav">Guardando…</span>}
          {guardado === 'guardado' && <span className="ed-sav ok">✓ Borrador guardado</span>}
          {guardado === 'error' && <span className="ed-sav mal">✗ No se guardó</span>}
        </div>
        {/* Publicar NO es un paso de la carga: es lo que hacés cuando ya terminaste. Fue
            el tercer casillero de la franja por un rato y salió mal — brillaba "acá
            estás" mientras seguías trabajando en otra pestaña, y abría un panel encima de
            los otros dos pasos. Como botón dice lo que es, y el contador avisa cuánto
            falta publicar sin tener que abrirlo. */}
        <button
          className={`ed-abrir-pub${errores.length ? ' con-errores' : ''}`}
          onClick={() => setPanel(true)}
        >
          Cuando termines, revisá y publicá
          {reversibles.length > 0 && <span className="ed-badge">{reversibles.length}</span>}
          {errores.length > 0 && (
            <span className="ed-badge mal" title={`${errores.length} error(es) que bloquean`}>
              !
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="adm-error">
          <div>
            <strong>Error al guardar.</strong> {error}
          </div>
          <button className="lnk" onClick={() => setError(null)}>
            Entendido
          </button>
        </div>
      )}

      {!puedeEditar && (
        <div className="ed-solo-lectura">
          Estás viendo este plan en <strong>solo lectura</strong>: tu cuenta no tiene permiso de
          edición en esta universidad.
        </div>
      )}

      {/* Los DOS pasos de la carga, con dónde estás y cuánto falta. Cada uno lleva a su
          pestaña — y ninguno abre nada encima: publicar es un botón aparte, porque no es
          una etapa por la que se avanza sino algo que hacés cuando ya terminaste. */}
      <ol className="ed-pasos">
        {pasos.lista.map((paso) => (
          <li
            className={`ed-paso ${paso.estado}${
              paso.destino === pestania ? ' aqui' : ''
            }`}
            key={paso.n}
          >
            <button
              className="ed-paso-btn"
              onClick={() => setPestania(paso.destino)}
              aria-current={paso.destino === pestania ? 'step' : undefined}
            >
              <span className="ed-paso-n" aria-hidden="true">
                {paso.hecho ? '✓' : paso.n}
              </span>
              <span className="ed-paso-txt">
                <span className="ed-paso-tit">{paso.titulo}</span>
                <span className="ed-paso-det">{paso.detalle}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="ed-tabs" role="tablist">
        {(
          [
            ['estructura', `Estructura · ${cuenta.materias}`],
            ['correlativas', `Correlativas · ${cuenta.correlativas}`],
            ['titulos', `Títulos · ${cuenta.titulos}`],
          ] as Array<[Pestania, string]>
        ).map(([id, texto]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestania === id}
            className={`ed-tab ${pestania === id ? 'activa' : ''}`}
            onClick={() => setPestania(id)}
          >
            {texto}
          </button>
        ))}
      </div>

      {/* ── ESTRUCTURA ── */}
      {pestania === 'estructura' && (
        <div className="ed-cuerpo">
          {anios.length === 0 && (
            <p className="adm-meta">
              El plan está vacío. Agregá el primer año para empezar a cargar materias.
            </p>
          )}
          {anios.map((anio) => (
            <section className="ed-anio" key={anio}>
              <h3>{anio}° año</h3>
              {[1, 2].map((cuatri) => {
                const filas = materias.filter((m) => m.anio === anio && m.cuatri === cuatri)
                return (
                  <div className="ed-cuatri" key={cuatri}>
                    <div className="ed-cuatri-tit">{cuatri}° cuatrimestre</div>
                    {filas.map((m) => {
                      const dup = b.codigoRepetido(m.cod, m.orden)
                      return (
                        <div
                          className={`ed-fila ${dup ? 'dup' : ''} ${
                            cambioPorCod.get(m.cod) ? `cam-${cambioPorCod.get(m.cod)}` : ''
                          }`}
                          key={m.orden}
                          title={
                            cambioPorCod.get(m.cod) ? 'Cambió respecto de lo publicado' : undefined
                          }
                        >
                          <input
                            className="ed-cod"
                            value={m.cod}
                            placeholder="opcional"
                            disabled={!puedeEditar}
                            aria-label="Código de la materia"
                            onFocus={() => (alEnfocar.current = b)}
                            onChange={(e) => cambiar(b.renombrarCodigo(m.orden, e.target.value))}
                            onBlur={() => {
                              anotarEdicion(`renombrar el código a ${m.cod || '(vacío)'}`, {
                                que: 'materia',
                                cod: m.codOriginal ?? m.cod,
                              })
                              guardarFila(m)
                            }}
                          />
                          <input
                            className="ed-nom"
                            value={m.nom}
                            placeholder="nombre de la materia"
                            disabled={!puedeEditar}
                            aria-label="Nombre de la materia"
                            onChange={(e) => {
                              const nuevo = b.editarMateria(m.orden, { nom: e.target.value })
                              cambiar(nuevo)
                              guardarConDemora(m.con({ nom: e.target.value }))
                            }}
                            onFocus={() => (alEnfocar.current = b)}
                            onBlur={() => {
                              anotarEdicion(`renombrar ${m.cod || 'la materia'}`, {
                                que: 'materia',
                                cod: m.codOriginal ?? m.cod,
                              })
                              // Sin código, se le pone uno: no todas las universidades
                              // numeran sus materias, pero la base necesita una identidad.
                              if (!m.cod.trim() && m.nom.trim()) {
                                const cod = b.codigoLibre()
                                cambiar(b.renombrarCodigo(m.orden, cod))
                                guardarFila(m.con({ cod }))
                                return
                              }
                              guardarFila(m)
                            }}
                          />
                          <select
                            className="ed-mover"
                            value={`${m.anio}-${m.cuatri}`}
                            disabled={!puedeEditar}
                            aria-label="Año y cuatrimestre"
                            onChange={(e) => {
                              const [a, c] = e.target.value.split('-').map(Number)
                              const { borrador, rotas } = b.moverMateria(m.orden, a, c)
                              const mover = (): void => {
                                aplicar(borrador, `mover ${m.cod || 'la materia'}`, {
                                  que: 'materia',
                                  cod: m.codOriginal ?? m.cod,
                                })
                                guardarFila(m.con({ anio: a, cuatri: c }))
                              }
                              if (rotas.length === 0) return mover()
                              pedir({
                                titulo: 'Moverla rompe correlativas',
                                texto: `Quedan ${rotas.length} imposibles de cursar: la previa pasaría a estar en el mismo cuatrimestre o después. Vas a tener que corregirlas antes de publicar.`,
                                detalle: rotas.map(
                                  (r) => `${nombreDe(r.cod)} necesita ${nombreDe(r.requiere)}`,
                                ),
                                confirmar: 'Moverla igual',
                                onSi: mover,
                              })
                            }}
                          >
                            {opcionesCuatri.map((o) => (
                              <option key={o.valor} value={o.valor}>
                                {o.texto}
                              </option>
                            ))}
                          </select>
                          <button
                            className={`ed-chip ${m.opt ? 'on' : ''}`}
                            disabled={!puedeEditar}
                            title="OPTATIVA — el plan reserva el lugar y el alumno elige qué cursar; es él quien le pone el nombre."
                            onClick={() => {
                              const nuevo = b.editarMateria(m.orden, { opt: !m.opt })
                              aplicar(nuevo, `marcar ${m.cod || 'la materia'} como optativa`, {
                                que: 'materia',
                                cod: m.codOriginal ?? m.cod,
                              })
                              guardarFila(m.con({ opt: !m.opt }))
                            }}
                          >
                            OPT
                          </button>
                          <button
                            className={`ed-chip ${m.especial ? 'on' : ''}`}
                            disabled={!puedeEditar}
                            title="ESPECIAL — se habilita por un requisito global (tener N° año aprobado, un % de la carrera), no por materias puntuales."
                            onClick={() => {
                              const nuevo = b.editarMateria(m.orden, { especial: !m.especial })
                              aplicar(nuevo, `marcar ${m.cod || 'la materia'} como especial`, {
                                que: 'materia',
                                cod: m.codOriginal ?? m.cod,
                              })
                              guardarFila(m.con({ especial: !m.especial }))
                            }}
                          >
                            ESP
                          </button>
                          <button
                            className="ed-borrar"
                            disabled={!puedeEditar}
                            title="Borrar la materia"
                            onClick={() => {
                              const dependen = b.dependenDe(m.cod)
                              pedir({
                                titulo: `¿Borrar ${m.nom || m.cod || 'esta materia'}?`,
                                texto: dependen.length
                                  ? 'Estas materias la tienen como previa: esas correlativas se borran también.'
                                  : undefined,
                                detalle: dependen.map((c) => nombreDe(c)),
                                confirmar: 'Borrar',
                                peligro: true,
                                onSi: () => {
                                  // deshacer un borrado es volver a INSERTAR la fila: por eso
                                  // la escritura de vuelta es 'materia', no 'materia-borrar'
                                  aplicar(
                                    b.quitarMateria(m.orden),
                                    `borrar ${m.cod || 'la materia'}`,
                                    { que: 'materia', cod: m.cod },
                                  )
                                  if (m.codOriginal) {
                                    void correr(() => repo.borrarMateria(planId, m.codOriginal!))
                                  }
                                },
                              })
                            }}
                          >
                            ✕
                          </button>
                          {dup && <span className="ed-dup">código repetido</span>}
                        </div>
                      )
                    })}
                    {puedeEditar && (
                      <button
                        className="ed-add"
                        onClick={() =>
                          aplicar(
                            b.agregarMateria(anio, cuatri).borrador,
                            'agregar una materia',
                            null, // la fila nueva todavía no existe en la base
                          )
                        }
                      >
                        + materia
                      </button>
                    )}
                  </div>
                )
              })}
            </section>
          ))}
          {puedeEditar && (
            <button
              className="ed-add-anio"
              onClick={() =>
                aplicar(
                  b.agregarMateria((anios.at(-1) ?? 0) + 1, 1).borrador,
                  'agregar un año',
                  null,
                )
              }
            >
              + agregar {(anios.at(-1) ?? 0) + 1}° año
            </button>
          )}
        </div>
      )}

      {/* ── CORRELATIVAS ──
          Acá se TRABAJA; el árbol es para MIRAR el resultado.

          Dos intentos fallidos antes de este, y los dos por la misma razón de fondo:
          la pantalla no ponía la respuesta al lado de la pregunta.

          1) El ÁRBOL como editor (feedback de Luz, 12-ago: "no sé qué hice y qué no y qué
             conecté con qué"). Lo ya conectado se distinguía por el borde de una tarjeta
             que podía estar a tres pantallas de scroll.
          2) La lista, con "necesita X" alineado al BORDE DERECHO ("me da náuseas,
             literalmente no se entiende nada"). Con 52 materias en 1280px, leer
             "Programación II necesita Programación I" era cruzar la pantalla entera,
             cincuenta y dos veces. Una tabla con puntos suspensivos, sin los puntos.

          Lo que quedó, y por qué:
          - Nombre y previas en DOS COLUMNAS pegadas y alineadas entre sí. El ojo baja por
            una columna, no cruza el ancho.
          - NADA cuando no hay previas. Antes decía "sin cargar" en 22 filas y se leía como
            22 alarmas — pero la mayoría de esas materias no llevan previas y nunca van a
            llevar. No se puede distinguir "no lleva" de "no la cargué todavía", así que
            marcarlo como problema es mentir. Para saber qué falta está el filtro, que es
            una pregunta que se hace UNA vez y no 52.
          - "Las de 1° cuatrimestre no llevan previas" se dice una vez por bloque, no una
            vez por materia.
          - Al abrir, un BUSCADOR y no 30 casillas (45 en 4° año). Quien carga tiene el plan
            de la facultad delante y lee "Correlativa: Programación I": escribir "prog" y
            elegir es más corto que barrer una grilla. La lista completa sigue estando
            abajo, en alto fijo, para quien prefiera mirarla. */}
      {pestania === 'correlativas' && (
        <div className="ed-cuerpo">
          <div className="ed-invita">
            <div>
              <h3>Qué necesita cada materia</h3>
              <p>
                Abrí una materia y elegí las que hay que tener antes. Solo aparecen las de
                cuatrimestres anteriores, así no se puede cargar una imposible.
              </p>
            </div>
            <button className="lnk" onClick={() => setArbol(true)}>
              Ver el árbol
            </button>
          </div>

          {/* El "¿qué me falta?" como una pregunta que se hace una vez. */}
          <div className="ed-filtro">
            <label>
              <input
                type="checkbox"
                checked={soloSinPrevias}
                onChange={(e) => setSoloSinPrevias(e.target.checked)}
              />
              Ver solo las que todavía no tienen previas
            </label>
            <span className="adm-meta">
              {conPrevias} de {conectables.length} materias con previas
            </span>
          </div>

          {anios.map((anio) => {
            const bloques = [1, 2]
              .map((cuatri) => ({
                cuatri,
                filas: materias.filter(
                  (m) =>
                    m.anio === anio &&
                    m.cuatri === cuatri &&
                    m.cod.trim() &&
                    (!soloSinPrevias || (b.elegiblesComoPrevia(m.cod).length > 0 && !m.opt && b.previasDe(m.cod).length === 0)),
                ),
              }))
              .filter((x) => x.filas.length > 0)
            if (bloques.length === 0) return null
            return (
              <div className="ed-anio" key={anio}>
                <div className="ed-anio-tit">{anio}° año</div>
                {bloques.map(({ cuatri, filas }) => {
                  // Todo el bloque es de arranque del plan: se dice acá, no en cada fila.
                  const arranque = filas.every((m) => b.elegiblesComoPrevia(m.cod).length === 0)
                  return (
                    <div className="ed-cuatri" key={cuatri}>
                      <div className="ed-cuatri-tit">
                        {cuatri}° cuatrimestre
                        {arranque && <em> · no llevan previas: no hay nada antes</em>}
                      </div>
                      {filas.map((m) => {
                        const previas = b.previasDe(m.cod)
                        const elegibles = b.elegiblesComoPrevia(m.cod)
                        const abierta = objetivo === m.cod
                        const fija = elegibles.length === 0 || m.opt
                        const nombreDe = (c: string): string =>
                          b.materias.find((x) => x.cod === c)?.nom || c
                        return (
                          <div
                            className={`ed-cx${abierta ? ' abierta' : ''}${fija ? ' fija' : ''}`}
                            key={m.orden}
                          >
                            <button
                              className="ed-cx-cab"
                              onClick={() => {
                                setObjetivo(abierta ? null : m.cod)
                                setBusca('')
                              }}
                              disabled={fija}
                              aria-expanded={abierta}
                            >
                              <span className="ed-cx-flecha" aria-hidden="true">
                                {fija ? '' : abierta ? '▾' : '▸'}
                              </span>
                              <span className="ed-cx-nom">{m.nom || m.cod}</span>
                              {/* La respuesta al lado de la pregunta. Vacío si no hay: la
                                  ausencia de previas no es un pendiente. */}
                              <span className="ed-cx-est">
                                {m.opt ? (
                                  <em>optativa: no lleva correlativas</em>
                                ) : (
                                  previas.map((c) => (
                                    <span className="ed-pill" key={c}>
                                      {nombreDe(c)}
                                    </span>
                                  ))
                                )}
                              </span>
                            </button>

                            {abierta && (
                              <div className="ed-cx-panel">
                                <input
                                  className="ed-cx-busca"
                                  type="search"
                                  autoFocus
                                  placeholder="Escribí parte del nombre o el código…"
                                  value={busca}
                                  onChange={(e) => setBusca(e.target.value)}
                                />
                                <div className="ed-cx-lista">
                                  {(() => {
                                    const q = busca.trim().toLowerCase()
                                    const vistos = q
                                      ? elegibles.filter(
                                          (e) =>
                                            e.nom.toLowerCase().includes(q) ||
                                            e.cod.toLowerCase().includes(q),
                                        )
                                      : elegibles
                                    if (vistos.length === 0)
                                      return (
                                        <p className="ed-cx-nada">
                                          Ninguna materia anterior coincide con “{busca}”.
                                        </p>
                                      )
                                    return vistos.map((e) => {
                                      const puesta = previas.includes(e.cod)
                                      return (
                                        <label
                                          className={`ed-cx-op${puesta ? ' si' : ''}`}
                                          key={e.orden}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={puesta}
                                            disabled={!puedeEditar}
                                            onChange={() => {
                                              const nuevo = b.alternarPrevia(m.cod, e.cod)
                                              aplicar(
                                                nuevo,
                                                `${puesta ? 'quitar' : 'poner'} ${e.nom || e.cod} como previa de ${m.nom || m.cod}`,
                                                { que: 'previas', cod: m.cod },
                                              )
                                              void correr(() =>
                                                repo.guardarPrevias(
                                                  planId,
                                                  m.cod,
                                                  nuevo.previasDe(m.cod),
                                                ),
                                              )
                                            }}
                                          />
                                          <span className="adm-meta">
                                            {e.anio}°·{e.cuatri}C
                                          </span>
                                          <span className="ed-cx-op-nom">{e.nom || e.cod}</span>
                                        </label>
                                      )
                                    })
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TÍTULOS ── */}
      {pestania === 'titulos' && (
        <div className="ed-cuerpo">
          <p className="adm-meta">
            Un título se otorga al aprobar todo hasta el año indicado (o hasta un
            cuatrimestre, si el hito cae a mitad de año).
          </p>
          {b.titulos.map((t, i) => (
            <div className="ed-fila" key={i}>
              <input
                className="ed-nom"
                value={t.nombre}
                placeholder="nombre del título"
                disabled={!puedeEditar}
                aria-label="Nombre del título"
                onChange={(e) => {
                  const titulos = b.titulos.map((x, j) =>
                    j === i ? new TituloPlan(e.target.value, x.hastaAnio, x.hastaCuatri) : x,
                  )
                  cambiar(b.conTitulos(titulos))
                }}
                onBlur={() => void correr(() => repo.guardarTitulos(planId, b.titulos))}
              />
              <select
                className="ed-mover ed-hasta"
                value={`${t.hastaAnio}-${t.hastaCuatri ?? 0}`}
                disabled={!puedeEditar}
                aria-label="Hasta qué año y cuatrimestre"
                onChange={(e) => {
                  const [a, c] = e.target.value.split('-').map(Number)
                  const titulos: TituloPlan[] = b.titulos.map((x, j) =>
                    j === i ? new TituloPlan(x.nombre, a, c || undefined) : x,
                  )
                  cambiar(b.conTitulos(titulos))
                  void correr(() => repo.guardarTitulos(planId, titulos))
                }}
              >
                {(anios.length ? anios : [1]).flatMap((a) => [
                  <option key={`${a}-0`} value={`${a}-0`}>
                    hasta {a}° año completo
                  </option>,
                  <option key={`${a}-1`} value={`${a}-1`}>
                    hasta {a}° · 1°C
                  </option>,
                  <option key={`${a}-2`} value={`${a}-2`}>
                    hasta {a}° · 2°C
                  </option>,
                ])}
              </select>
              <button
                className="ed-borrar"
                disabled={!puedeEditar}
                onClick={() => {
                  const titulos = b.titulos.filter((_, j) => j !== i)
                  cambiar(b.conTitulos(titulos))
                  void correr(() => repo.guardarTitulos(planId, titulos))
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {puedeEditar && (
            <button
              className="ed-add"
              onClick={() =>
                aplicar(
                  b.conTitulos([...b.titulos, new TituloPlan('', anios.at(-1) ?? 1)]),
                  'agregar un título',
                  { que: 'titulos' },
                )
              }
            >
              + título
            </button>
          )}
        </div>
      )}

      {/* ── REVISAR Y PUBLICAR ── */}
      {panel && (
        <Drawer
          titulo="Revisar y publicar"
          desc="Esto es lo que va a cambiar para los alumnos cuando publiques."
          onClose={() => setPanel(false)}
          accion={
            puedeEditar ? (
              <button
                className="btn"
                disabled={errores.length > 0 || publicando || nadaQuePublicar}
                title={
                  errores.length > 0
                    ? 'Hay errores que hay que corregir antes de publicar'
                    : nadaQuePublicar
                      ? 'El borrador es idéntico a lo que ya ven los alumnos'
                      : undefined
                }
                onClick={publicarAhora}
              >
                {publicando ? 'Publicando…' : publicado ? 'Publicar los cambios' : 'Publicar el plan'}
              </button>
            ) : undefined
          }
        >

        {/* Qué van a ver los alumnos que hoy no ven. Es la comparación contra la foto
            publicada, así que sobrevive a recargar y no puede mentir. */}
        <div className="ed-cambios">
          {nadaQuePublicar ? (
            <p className="adm-meta">
              El borrador es idéntico a la versión que ven los alumnos: no hay nada que
              publicar.
            </p>
          ) : (
            <>
              {(diff?.grupos ?? []).map((g) => (
                <section className="ed-grupo" key={g.tipo}>
                  <div className={`ed-grupo-tit ${g.tipo}`}>
                    <span className="ed-cam-signo" aria-hidden="true">
                      {SIGNO[g.tipo]}
                    </span>
                    {g.etiqueta}
                  </div>
                  <ul className="ed-cambios-lista">
                    {g.cambios.map((c) => (
                      <li className={`ed-cam ${c.tipo}`} key={c.id}>
                        <span className="ed-cam-txt">
                          {c.titulo && <span className="ed-cam-tit">{c.titulo}</span>}
                          {c.detalle && <span className="ed-cam-det">{c.detalle}</span>}
                          {c.partes?.map((pt) => (
                            <span className="ed-parte" key={pt.campo}>
                              <span className="ed-parte-campo">{pt.campo}</span>
                              <span className="ed-antes">{pt.antes}</span>
                              <span className="ed-parte-despues">
                                <span className="ed-flecha" aria-hidden="true">
                                  →
                                </span>
                                <span className="ed-despues">{pt.despues}</span>
                              </span>
                            </span>
                          ))}
                        </span>
                        {c.reversible && puedeEditar && (
                          <button className="lnk ed-cam-des" onClick={() => deshacer(c)}>
                            deshacer
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {reversibles.length > 1 && puedeEditar && (
                <button className="ed-descartar" onClick={descartarTodo}>
                  ↺ Descartar los {reversibles.length} cambios y volver a lo publicado
                </button>
              )}
            </>
          )}
        </div>
        {errores.length === 0 ? (
          <p className="ed-verde">✓ El plan no tiene errores: se puede publicar.</p>
        ) : (
          <>
            <p className="ed-rojo">
              {errores.length} {errores.length === 1 ? 'error' : 'errores'} — hay que
              corregirlos antes de publicar:
            </p>
            <ul className="ed-hallazgos">
              {errores.slice(0, 12).map((h, i) => (
                <li key={i} className="err">
                  {h.mensaje}
                </li>
              ))}
            </ul>
          </>
        )}
        {avisos.length > 0 && (
          <ul className="ed-hallazgos">
            {avisos.map((h, i) => (
              <li key={i} className="avi">
                {h.mensaje}
              </li>
            ))}
          </ul>
        )}

        {/* El campo se queda en el cuerpo (es contenido); el botón se fue al PIE del
            drawer, que es de donde lo intuitivo es publicar. */}
        {puedeEditar && (
          <input
            className="ed-nom ed-pub-nota"
            value={nota}
            placeholder="Observaciones (opcional, quedan en el historial)"
            aria-label="Nota de la versión"
            onChange={(e) => setNota(e.target.value)}
          />
        )}

        {versiones.length > 0 && (
          <div className="ed-versiones">
            <div className="ed-cuatri-tit">Historial</div>
            {versiones.map((v) => (
              <div className="ed-ver" key={v.version}>
                <span className="adm-meta">v{v.version}</span>
                <span className="ed-ver-fecha adm-meta">
                  {new Date(v.publicado_at).toLocaleDateString('es-AR')}
                </span>
                <span className="ed-ver-nota">{v.nota ?? '—'}</span>
                {puedeEditar && v.version !== versiones[0].version && (
                  <button
                    className="lnk"
                    onClick={() => {
                      pedir({
                        titulo: `¿Volver a la versión ${v.version}?`,
                        texto:
                          'Los alumnos pasan a ver esa foto. Tu borrador no se toca: seguís editando desde donde ibas.',
                        confirmar: 'Volver a esa versión',
                        onSi: () =>
                          void correr(async () => {
                            await repo.revertir(planId, v.version)
                            setVersiones(await repo.cargarVersiones(planId))
                            setHistorial((h) => h.vaciado())
                          }),
                      })
                    }}
                  >
                    Volver a esta
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        </Drawer>
      )}

      {dialogo}

      {/* ── EL ÁRBOL COMO EDITOR ── */}
      {arbol && (
        <>
          <div className="ed-arbol-bar">
            {!objetivo ? (
              <span className="ed-ab-guia">
                <strong>Tocá una materia</strong> del árbol para empezar a conectarla.
              </span>
            ) : (
              <>
                <span className="ed-ab-quien">
                  <span className="ed-ab-lbl">Estás con</span>
                  <span className="ed-ab-obj">
                    {b.materias.find((m) => m.cod === objetivo)?.nom || objetivo}
                  </span>
                </span>
                <span className="ed-ab-dir">
                  <button
                    className={direccion === 'anterior' ? 'on' : ''}
                    onClick={() => setDireccion('anterior')}
                  >
                    necesita…
                  </button>
                  <button
                    className={direccion === 'posterior' ? 'on' : ''}
                    onClick={() => setDireccion('posterior')}
                  >
                    habilita…
                  </button>
                </span>
                {/* La instrucción dice los DOS gestos, porque son los dos que hay: tocar
                    una iluminada conecta, tocar cualquier otra cambia de materia. Antes
                    el segundo estaba escondido en un enlace de texto al final. */}
                <span className="ed-ab-guia">
                  {elegiblesAhora.size === 0 ? (
                    <>
                      No hay materias{' '}
                      {direccion === 'anterior' ? 'en cuatrimestres anteriores' : 'después'}.
                      Tocá otra materia para cambiar.
                    </>
                  ) : (
                    <>
                      Tocá las <strong>{elegiblesAhora.size} iluminadas</strong> para conectar o
                      desconectar · tocá cualquier otra para cambiar de materia
                    </>
                  )}
                </span>
              </>
            )}
            <button className="ed-ab-listo" onClick={() => setArbol(false)}>
              Listo
            </button>
          </div>
          <Suspense fallback={<div className="tv-cargando" />}>
            <TreeView
              focus={objetivo}
              onClose={() => setArbol(false)}
              planExterno={planDelBorrador ?? undefined}
              edicion={{
                objetivo: objetivo ?? '',
                direccion,
                elegibles: elegiblesAhora,
                yaConectadas: conectadasAhora,
                onElegirObjetivo: setObjetivo,
                porQueNo: (cod) => (objetivo ? b.porQueNo(objetivo, cod, direccion) : null),
                onAlternar: (cod) => {
                  if (!objetivo) {
                    setObjetivo(cod)
                    return
                  }
                  if (!puedeEditar) return
                  // la arista es la misma en las dos direcciones: cambia quién es el dueño
                  const [dueno, previa] =
                    direccion === 'anterior' ? [objetivo, cod] : [cod, objetivo]
                  const nuevo = b.alternarPrevia(dueno, previa)
                  const habia = b.previasDe(dueno).includes(previa)
                  aplicar(
                    nuevo,
                    `${habia ? 'quitar' : 'conectar'} ${dueno} ← ${previa}`,
                    { que: 'previas', cod: dueno },
                  )
                  void correr(() => repo.guardarPrevias(planId, dueno, nuevo.previasDe(dueno)))
                },
              }}
            />
          </Suspense>
        </>
      )}
    </div>
  )
}

/**
 * Cajón lateral, con el mismo comportamiento que los del alumno (Notas): se cierra con
 * Escape, con la ✕ o clickeando afuera, y con la misma animación de salida. Reusa sus
 * clases a propósito: es la misma app, no tiene por qué sentirse distinta.
 */
/**
 * El drawer lateral, con el mismo comportamiento que el de Notas del alumno (Escape ·
 * clic afuera · ✕ · misma animación, reusando sus clases a propósito).
 *
 * `accion` es la acción PRINCIPAL del panel y va en el pie. Antes el pie tenía un botón
 * primario que decía "Listo" y solo cerraba, mientras "Publicar" quedaba a mitad del
 * cuerpo: la posición que grita "apretame" no hacía nada y la que importaba estaba
 * escondida (lo marcó Luz, 12-ago — "lo intuitivo es publicarlo con el botón de la
 * posición Listo"). Ahora el pie lleva la acción y cerrar es el secundario.
 */
function Drawer({
  titulo,
  desc,
  onClose,
  accion,
  children,
}: {
  titulo: string
  desc: string
  onClose: () => void
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  const { closing, requestClose, onExitEnd } = useExitAnimation(onClose)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose])

  return (
    <div
      className={`drawer-wrap${closing ? ' closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <aside className="drawer ed-drawer" onAnimationEnd={onExitEnd}>
        <div className="drawer-head">
          <div>
            <h2>{titulo}</h2>
            <p className="m-desc">{desc}</p>
          </div>
          <button className="tv-close" type="button" onClick={requestClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="drawer-body ed-drawer-body">{children}</div>
        <div className="drawer-foot">
          {accion ? (
            <>
              <button className="lnk" type="button" onClick={requestClose}>
                Cerrar
              </button>
              {accion}
            </>
          ) : (
            /* Sin acción (quien solo puede mirar) el pie cierra, y ahí sí es lo principal. */
            <button className="btn" type="button" onClick={requestClose}>
              Listo
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
