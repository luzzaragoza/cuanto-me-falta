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

  // Qué cambió contra lo que ven los alumnos. Se recalcula con cada edición: es una
  // comparación, no un registro de acciones, así que no puede quedar desincronizada.
  const diff = useMemo(() => (b ? new Diff(publicado, b) : null), [publicado, b])
  const cambios = diff?.cambios ?? []
  const reversibles = diff?.reversibles ?? []

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
  const materias = b.ordenadas

  const cambiar = (nuevo: Borrador): void => setB(nuevo)

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
    if (!confirm(`¿Descartar los ${reversibles.length} cambios y volver a la versión publicada?`)) {
      return
    }
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

  const opcionesCuatri = (anios.length ? anios : [1]).flatMap((a) =>
    [1, 2].map((c) => ({ valor: `${a}-${c}`, texto: `${a}° · ${c}°C` })),
  )

  return (
    <div className="ed">
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
        <div className="ed-estado">
          {guardado === 'guardando' && <span className="ed-sav">Guardando…</span>}
          {guardado === 'guardado' && <span className="ed-sav ok">✓ Borrador guardado</span>}
          {guardado === 'error' && <span className="ed-sav mal">✗ No se guardó</span>}
        </div>
        {/* Vive en la barra y no debajo de una pestaña: se llega desde cualquier parte
            del editor, y el contador dice cuánto falta publicar sin tener que abrirlo. */}
        <button
          className={`ed-abrir-pub${errores.length ? ' con-errores' : ''}`}
          onClick={() => setPanel(true)}
        >
          Revisar y publicar
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
                        <div className={`ed-fila ${dup ? 'dup' : ''}`} key={m.orden}>
                          <input
                            className="ed-cod"
                            value={m.cod}
                            placeholder="código"
                            disabled={!puedeEditar}
                            aria-label="Código de la materia"
                            onChange={(e) => cambiar(b.renombrarCodigo(m.orden, e.target.value))}
                            onBlur={() => guardarFila(m)}
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
                            onBlur={() => guardarFila(m)}
                          />
                          <select
                            className="ed-mover"
                            value={`${m.anio}-${m.cuatri}`}
                            disabled={!puedeEditar}
                            aria-label="Año y cuatrimestre"
                            onChange={(e) => {
                              const [a, c] = e.target.value.split('-').map(Number)
                              const { borrador, rotas } = b.moverMateria(m.orden, a, c)
                              if (
                                rotas.length &&
                                !confirm(
                                  `Moverla deja ${rotas.length} correlativa(s) imposible(s):\n` +
                                    rotas.map((r) => `${r.cod} ← ${r.requiere}`).join('\n') +
                                    '\n\n¿Moverla igual? Vas a tener que corregirlas antes de publicar.',
                                )
                              ) {
                                return
                              }
                              cambiar(borrador)
                              guardarFila(m.con({ anio: a, cuatri: c }))
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
                            title="Optativa: el alumno le pone el nombre. No participa de correlativas."
                            onClick={() => {
                              const nuevo = b.editarMateria(m.orden, { opt: !m.opt })
                              cambiar(nuevo)
                              guardarFila(m.con({ opt: !m.opt }))
                            }}
                          >
                            OPT
                          </button>
                          <button
                            className={`ed-chip ${m.especial ? 'on' : ''}`}
                            disabled={!puedeEditar}
                            title="Se habilita por requisito especial (por año o % de carrera), no por correlativa."
                            onClick={() => {
                              const nuevo = b.editarMateria(m.orden, { especial: !m.especial })
                              cambiar(nuevo)
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
                              const aviso = dependen.length
                                ? `\n\nOjo: ${dependen.join(', ')} la tienen como previa. Esas correlativas se borran también.`
                                : ''
                              if (!confirm(`¿Borrar ${m.cod || 'esta materia'}?${aviso}`)) return
                              cambiar(b.quitarMateria(m.orden))
                              if (m.codOriginal) {
                                void correr(() => repo.borrarMateria(planId, m.codOriginal!))
                              }
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
                        onClick={() => cambiar(b.agregarMateria(anio, cuatri).borrador)}
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
                cambiar(b.agregarMateria((anios.at(-1) ?? 0) + 1, 1).borrador)
              }
            >
              + agregar {(anios.at(-1) ?? 0) + 1}° año
            </button>
          )}
        </div>
      )}

      {/* ── CORRELATIVAS ── */}
      {pestania === 'correlativas' && (
        <div className="ed-cuerpo">
          <div className="ed-invita">
            <div>
              <h3>Las correlativas se cargan sobre el árbol</h3>
              <p>
                Elegís una materia, elegís si querés cargar lo que <strong>necesita</strong> o
                lo que <strong>habilita</strong>, y vas tocando materias: las que se pueden
                conectar se iluminan. Los colores son los mismos que ven los alumnos —{' '}
                <span className="ed-leyenda previa">violeta lo que necesita</span>,{' '}
                <span className="ed-leyenda habilita">teal lo que habilita</span>.
              </p>
            </div>
            <button className="btn" onClick={() => setArbol(true)}>
              Abrir el árbol
            </button>
          </div>

          <div className="ed-cuatri-tit">Cómo va la carga</div>
          <div className="ed-resumen-corr">
            {materias
              .filter((m) => m.cod.trim() && !m.opt)
              .map((m) => {
                const n = b.previasDe(m.cod).length
                const primerCuatri = m.anio === (anios[0] ?? 1) && m.cuatri === 1
                return (
                  <button
                    key={m.orden}
                    className={`ed-rc ${n ? 'con' : primerCuatri ? 'na' : 'sin'}`}
                    title={
                      n
                        ? `Necesita: ${b.previasDe(m.cod)
                            .map((c) => b.materias.find((x) => x.cod === c)?.nom ?? c)
                            .join(', ')}`
                        : primerCuatri
                          ? 'Es del primer cuatrimestre: no puede tener previas'
                          : 'Todavía no tiene correlativas cargadas'
                    }
                    onClick={() => {
                      setObjetivo(m.cod)
                      setArbol(true)
                    }}
                  >
                    <span className="adm-meta">
                      {m.anio}°·{m.cuatri}C
                    </span>
                    <span className="ed-corr-nom">{m.nom || m.cod}</span>
                    <span className="ed-rc-n">{n ? `${n} previa${n > 1 ? 's' : ''}` : primerCuatri ? '—' : 'sin cargar'}</span>
                  </button>
                )
              })}
          </div>
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
                cambiar(b.conTitulos([...b.titulos, new TituloPlan('', anios.at(-1) ?? 1)]))
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
        >

        {/* Qué van a ver los alumnos que hoy no ven. Es la comparación contra la foto
            publicada, así que sobrevive a recargar y no puede mentir. */}
        <div className="ed-cambios">
          {reversibles.length === 0 && cambios.length === 0 ? (
            <p className="adm-meta">
              El borrador es idéntico a la versión que ven los alumnos: no hay nada que
              publicar.
            </p>
          ) : (
            <>
              <div className="ed-cuatri-tit">
                {publicado
                  ? `Cambios sin publicar · ${reversibles.length}`
                  : 'Sin publicar todavía'}
              </div>
              <ul className="ed-cambios-lista">
                {cambios.map((c) => (
                  <li className={`ed-cam ${c.tipo}`} key={c.id}>
                    <span className="ed-cam-signo" aria-hidden="true">
                      {SIGNO[c.tipo]}
                    </span>
                    <span className="ed-cam-txt">
                      <span className="ed-cam-tit">{c.titulo}</span>
                      {c.detalle && <span className="ed-cam-det">{c.detalle}</span>}
                    </span>
                    {c.reversible && puedeEditar && (
                      <button className="lnk ed-cam-des" onClick={() => deshacer(c)}>
                        deshacer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
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

        {puedeEditar && (
          <div className="ed-pub-fila">
            <input
              className="ed-nom"
              value={nota}
              placeholder="Qué cambió (opcional, queda en el historial)"
              aria-label="Nota de la versión"
              onChange={(e) => setNota(e.target.value)}
            />
            <button
              className="btn"
              disabled={errores.length > 0 || publicando}
              onClick={() => {
                if (!confirm('¿Publicar? Los alumnos van a ver esta versión.')) return
                setPublicando(true)
                void (async () => {
                  try {
                    const v = await repo.publicar(planId, nota.trim() || null)
                    setNota('')
                    setVersiones(await repo.cargarVersiones(planId))
                    setError(null)
                    alert(`Publicado como versión ${v}.`)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e))
                  } finally {
                    setPublicando(false)
                  }
                })()
              }}
            >
              {publicando ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
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
                      if (!confirm(`¿Volver a la versión ${v.version}? Tu borrador no se toca.`)) {
                        return
                      }
                      void correr(async () => {
                        await repo.revertir(planId, v.version)
                        setVersiones(await repo.cargarVersiones(planId))
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

      {/* ── EL ÁRBOL COMO EDITOR ── */}
      {arbol && (
        <>
          <div className="ed-arbol-bar">
            {!objetivo ? (
              <span className="ed-ab-guia">
                <strong>Tocá una materia</strong> del árbol para empezar
              </span>
            ) : (
              <>
                <span className="ed-ab-obj">
                  {b.materias.find((m) => m.cod === objetivo)?.nom || objetivo}
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
                <span className="ed-ab-guia">
                  {elegiblesAhora.size === 0
                    ? direccion === 'anterior'
                      ? 'No hay materias en cuatrimestres anteriores.'
                      : 'No hay materias en cuatrimestres posteriores.'
                    : `Tocá las ${elegiblesAhora.size} materias iluminadas para conectar o desconectar`}
                </span>
                <button className="lnk" onClick={() => setObjetivo(null)}>
                  otra materia
                </button>
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
                  cambiar(nuevo)
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
function Drawer({
  titulo,
  desc,
  onClose,
  children,
}: {
  titulo: string
  desc: string
  onClose: () => void
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
          <button className="btn" type="button" onClick={requestClose}>
            Listo
          </button>
        </div>
      </aside>
    </div>
  )
}
